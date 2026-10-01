-- Atomically reserve per-user request and token budget before calling NVIDIA,
-- then settle the reservation with observed usage (or a conservative estimate
-- on client cancellation / unknown usage).
--
-- Deploy order: this migration must be applied before the matching code deploy;
-- reserve_ai_usage is intentionally fail-closed and the route will return 503
-- until the RPC exists.

begin;

alter table public.ai_usage
  add column if not exists reserved_tokens integer not null default 0;

create table if not exists public.ai_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references auth.users(id) on delete cascade,
  usage_day date not null,
  reserved_tokens integer not null check (reserved_tokens >= 0),
  settled_tokens integer,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

alter table public.ai_usage_reservations enable row level security;
revoke all on table public.ai_usage_reservations from public, anon, authenticated;
grant all on table public.ai_usage_reservations to service_role;

create index if not exists ai_usage_reservations_uid_day_idx
  on public.ai_usage_reservations (uid, usage_day);

create or replace function public.reserve_ai_usage(
  p_uid uuid,
  p_day date,
  p_request_cap integer,
  p_token_cap integer,
  p_reserved_tokens integer
)
returns table (reservation_id uuid, allowed boolean)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_requests integer;
  v_tokens integer;
  v_reserved integer;
  v_reservation_id uuid;
begin
  if p_uid is null or p_day is null
     or p_request_cap is null or p_request_cap < 0
     or p_token_cap is null or p_token_cap < 0
     or p_reserved_tokens is null or p_reserved_tokens < 0
     or p_reserved_tokens > 1000000 then
    raise exception 'invalid_ai_usage_reservation';
  end if;

  insert into public.ai_usage (uid, day, requests, total_tokens, reserved_tokens, updated_at)
  values (p_uid, p_day, 0, 0, 0, now())
  on conflict (uid, day) do nothing;

  select usage.requests, usage.total_tokens, usage.reserved_tokens
    into v_requests, v_tokens, v_reserved
    from public.ai_usage usage
   where usage.uid = p_uid and usage.day = p_day
   for update;

  if (p_request_cap > 0 and v_requests >= p_request_cap)
     or (p_token_cap > 0 and v_tokens::bigint + v_reserved::bigint + p_reserved_tokens::bigint > p_token_cap) then
    return query select null::uuid, false;
    return;
  end if;

  update public.ai_usage
     set requests = requests + 1,
         reserved_tokens = reserved_tokens + p_reserved_tokens,
         updated_at = now()
   where uid = p_uid and day = p_day;

  insert into public.ai_usage_reservations (uid, usage_day, reserved_tokens)
  values (p_uid, p_day, p_reserved_tokens)
  returning id into v_reservation_id;

  return query select v_reservation_id, true;
end;
$$;

create or replace function public.settle_ai_usage(
  p_reservation_id uuid,
  p_actual_tokens integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_reservation public.ai_usage_reservations%rowtype;
  v_actual_tokens integer;
begin
  if p_reservation_id is null or p_actual_tokens is null or p_actual_tokens < 0 then
    raise exception 'invalid_ai_usage_settlement';
  end if;

  select * into v_reservation
    from public.ai_usage_reservations
   where id = p_reservation_id
   for update;

  if not found then
    return false;
  end if;
  if v_reservation.settled_at is not null then
    return true;
  end if;
  if p_actual_tokens > 1000000 then
    raise exception 'invalid_ai_usage_settlement';
  end if;

  v_actual_tokens := p_actual_tokens;

  update public.ai_usage
     set total_tokens = total_tokens + v_actual_tokens,
         reserved_tokens = greatest(reserved_tokens - v_reservation.reserved_tokens, 0),
         updated_at = now()
   where uid = v_reservation.uid
     and day = v_reservation.usage_day;

  if not found then
    raise exception 'ai_usage_reservation_row_missing';
  end if;

  update public.ai_usage_reservations
     set settled_tokens = v_actual_tokens,
         settled_at = now()
   where id = p_reservation_id;

  return true;
end;
$$;

revoke all on function public.reserve_ai_usage(uuid, date, integer, integer, integer)
  from public, anon, authenticated;
revoke all on function public.settle_ai_usage(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_ai_usage(uuid, date, integer, integer, integer)
  to service_role;
grant execute on function public.settle_ai_usage(uuid, integer)
  to service_role;

commit;
