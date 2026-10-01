-- Ongoing retention for the shared rate-limit table.
--
-- The table previously had only a one-time cleanup at migration time, so every
-- distinct IP/user key accumulated forever. This version performs a cheap,
-- probabilistic sweep (roughly one call in two hundred) so expired rows are
-- removed without adding a per-request delete cost.

create or replace function public.rate_limit_check(
  p_key text,
  p_max integer,
  p_window_ms bigint
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_count integer;
begin
  if p_key is null or length(p_key) > 200
     or p_max is null or p_max <= 0
     or p_window_ms is null or p_window_ms <= 0 then
    return false;
  end if;

  insert into public.rate_limits (key, count, reset_at)
  values (p_key, 1, now() + make_interval(msecs => p_window_ms))
  on conflict (key) do update
    set count = case
          when public.rate_limits.reset_at <= now() then 1
          else public.rate_limits.count + 1
        end,
        reset_at = case
          when public.rate_limits.reset_at <= now() then excluded.reset_at
          else public.rate_limits.reset_at
        end
  returning count into v_count;

  -- Bounded sweep: only expired rows, only occasionally, and never more than a
  -- fixed batch so a burst of traffic cannot turn this into a long transaction.
  if random() < 0.005 then
    delete from public.rate_limits
     where key in (
       select key from public.rate_limits
        where reset_at < now() - interval '1 day'
        limit 500
     );
  end if;

  return v_count <= p_max;
end;
$$;

revoke all on function public.rate_limit_check(text, integer, bigint) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text, integer, bigint) to service_role;
