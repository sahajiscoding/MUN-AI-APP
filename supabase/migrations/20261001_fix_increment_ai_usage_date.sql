-- Fix atomic AI usage increment to cast the application day text to the existing date column.

create or replace function public.increment_ai_usage(
  p_uid uuid,
  p_day text,
  p_requests integer,
  p_tokens integer
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_uid is null or p_day is null or length(p_day) > 10 then
    raise exception 'invalid_ai_usage_input';
  end if;

  insert into public.ai_usage (uid, day, requests, total_tokens, updated_at)
  values (
    p_uid,
    p_day::date,
    greatest(coalesce(p_requests, 0), 0),
    greatest(coalesce(p_tokens, 0), 0),
    now()
  )
  on conflict (uid, day) do update set
    requests = public.ai_usage.requests + excluded.requests,
    total_tokens = public.ai_usage.total_tokens + excluded.total_tokens,
    updated_at = now();
end;
$$;

revoke all on function public.increment_ai_usage(uuid, text, integer, integer)
  from public, anon, authenticated;

grant execute on function public.increment_ai_usage(uuid, text, integer, integer)
  to service_role;
