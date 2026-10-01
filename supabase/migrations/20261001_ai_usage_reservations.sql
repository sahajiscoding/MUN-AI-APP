-- Atomically reserve per-user request and token budget before calling NVIDIA,
-- then settle the reservation with observed usage (or a conservative estimate
-- on client cancellation / unknown usage).
--
-- Deploy order: this migration must be applied before the matching code deploy;
-- reserve_ai_usage is intentionally fail-closed and the route will return 503
-- until the RPC exists.
--
-- Ledger reconciliation
-- ---------------------
-- public.ai_usage_reservations is created by 20260826_ai_usage_daily.sql and
-- already exists in deployed databases with this shape:
--
--   id, uid, usage_date, reserved_tokens (bigint, > 0), actual_tokens,
--   status ('pending' | 'settled' | 'released'), created_at, settled_at
--
-- This migration adopts that table as-is instead of declaring a second,
-- differently named one. `create table if not exists` silently does nothing
-- when the table exists, so a differing definition here would never take
-- effect while the statements after it still assumed it had. The functions
-- below therefore read and write usage_date / actual_tokens / status.
--
-- What this migration does NOT touch: existing reservation rows, existing
-- ai_usage rows (they only gain reserved_tokens = 0), the ai_usage_daily
-- table, or the earlier reserve_ai_tokens / reconcile_ai_tokens /
-- release_ai_tokens functions. Those are not called by the application and
-- are left in place; dropping them is a separate, deliberate cleanup.
--
-- Safe to re-run: every statement is idempotent, and the whole file runs in
-- one transaction, so any failure (including the schema guard below) leaves
-- the database exactly as it was.

begin;

-- Fail fast instead of queueing behind a long-running transaction and
-- stalling live traffic on these tables.
set local lock_timeout = '5s';

-- Tokens currently held by unsettled reservations for this user/day. Adding a
-- column with a constant default does not rewrite the table.
alter table public.ai_usage
  add column if not exists reserved_tokens integer not null default 0;

-- Normally a no-op (the table already exists). This only creates the ledger on
-- a database that never ran 20260826_ai_usage_daily.sql, and mirrors that
-- definition exactly so both paths converge on one shape.
create table if not exists public.ai_usage_reservations (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  reserved_tokens bigint not null check (reserved_tokens > 0),
  actual_tokens bigint,
  status text not null default 'pending' check (status in ('pending', 'settled', 'released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz,
  check (actual_tokens is null or actual_tokens >= 0)
);

alter table public.ai_usage_reservations enable row level security;
revoke all on table public.ai_usage_reservations from public, anon, authenticated;
grant all on table public.ai_usage_reservations to service_role;

-- Schema guard. plpgsql bodies are not checked against the schema when a
-- function is created, so a ledger with different columns would let this
-- migration "succeed" and only fail on the first user request. Abort (and roll
-- everything back) instead. This must stay ahead of the index statements below:
-- Postgres resolves an index's columns before it checks IF NOT EXISTS, so they
-- would otherwise fail first with a bare "column does not exist".
do $$
declare
  v_missing text;
begin
  select string_agg(expected.col, ', ' order by expected.col)
    into v_missing
    from (values
      ('id'), ('uid'), ('usage_date'), ('reserved_tokens'),
      ('actual_tokens'), ('status'), ('created_at'), ('settled_at')
    ) as expected(col)
   where not exists (
     select 1
       from pg_attribute a
      where a.attrelid = 'public.ai_usage_reservations'::regclass
        and a.attname = expected.col
        and a.attnum > 0
        and not a.attisdropped
   );

  if v_missing is not null then
    raise exception
      'public.ai_usage_reservations is missing column(s): %. Align it with 20260826_ai_usage_daily.sql before applying this migration.',
      v_missing;
  end if;
end;
$$;

-- Same names as 20260826_ai_usage_daily.sql, so these are no-ops where it ran.
create index if not exists ai_usage_reservations_uid_date_idx
  on public.ai_usage_reservations (uid, usage_date);
create index if not exists ai_usage_reservations_pending_idx
  on public.ai_usage_reservations (status, created_at)
  where status = 'pending';

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
  -- The ledger requires reserved_tokens > 0, so a zero reservation is invalid
  -- here as well rather than surfacing later as a constraint violation.
  if p_uid is null or p_day is null
     or p_request_cap is null or p_request_cap < 0
     or p_token_cap is null or p_token_cap < 0
     or p_reserved_tokens is null or p_reserved_tokens < 1
     or p_reserved_tokens > 1000000 then
    raise exception 'invalid_ai_usage_reservation';
  end if;

  insert into public.ai_usage (uid, day, requests, total_tokens, reserved_tokens, updated_at)
  values (p_uid, p_day, 0, 0, 0, now())
  on conflict (uid, day) do nothing;

  -- Row lock serializes concurrent reservations for the same user and day.
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

  insert into public.ai_usage_reservations (uid, usage_date, reserved_tokens, status)
  values (p_uid, p_day, p_reserved_tokens, 'pending')
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
  -- Already settled (or released): a retry or duplicate finalizer is a no-op,
  -- so tokens are never charged or released twice.
  if v_reservation.status <> 'pending' or v_reservation.settled_at is not null then
    return true;
  end if;
  if p_actual_tokens > 1000000 then
    raise exception 'invalid_ai_usage_settlement';
  end if;

  -- Charge the day the reservation was made, even if settlement lands after
  -- UTC midnight. The reservation column is bigint, the counter is integer;
  -- the result can only shrink, so the cast back cannot overflow.
  update public.ai_usage
     set total_tokens = total_tokens + p_actual_tokens,
         reserved_tokens = greatest(reserved_tokens::bigint - v_reservation.reserved_tokens, 0)::integer,
         updated_at = now()
   where uid = v_reservation.uid
     and day = v_reservation.usage_date;

  if not found then
    raise exception 'ai_usage_reservation_row_missing';
  end if;

  update public.ai_usage_reservations
     set actual_tokens = p_actual_tokens,
         status = 'settled',
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
