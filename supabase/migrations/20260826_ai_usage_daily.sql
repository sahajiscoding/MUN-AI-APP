-- Apply after the existing hardened data-contract migrations.
-- Daily usage is keyed by the UTC calendar date; no reset job is required.

create table if not exists public.ai_usage_daily (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  tokens_used bigint not null default 0 check (tokens_used >= 0),
  reserved_tokens bigint not null default 0 check (reserved_tokens >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (uid, usage_date)
);

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

alter table public.ai_usage_daily enable row level security;
alter table public.ai_usage_reservations enable row level security;

alter table public.ai_usage_daily add column if not exists reserved_tokens bigint default 0;
update public.ai_usage_daily set reserved_tokens = 0 where reserved_tokens is null;
alter table public.ai_usage_daily alter column reserved_tokens set default 0;
alter table public.ai_usage_daily alter column reserved_tokens set not null;

create index if not exists ai_usage_daily_uid_date_idx
  on public.ai_usage_daily (uid, usage_date);
create index if not exists ai_usage_reservations_uid_date_idx
  on public.ai_usage_reservations (uid, usage_date);
create index if not exists ai_usage_reservations_pending_idx
  on public.ai_usage_reservations (status, created_at)
  where status = 'pending';

-- No browser policies are created. The service-role server client is the only
-- caller of the RPCs and is responsible for authenticated UID ownership.
revoke all on table public.ai_usage_daily from anon, authenticated;
revoke all on table public.ai_usage_reservations from anon, authenticated;

-- These drops allow an operator to safely replace an earlier aggregate-only
-- draft of this migration before application traffic relies on the new contract.
drop function if exists public.reserve_ai_tokens(uuid, bigint, bigint);
drop function if exists public.reconcile_ai_tokens(uuid, bigint, bigint, bigint);
drop function if exists public.release_ai_tokens(uuid, bigint, bigint);
drop function if exists public.reconcile_ai_tokens(uuid, uuid, bigint, bigint);
drop function if exists public.release_ai_tokens(uuid, uuid, bigint);

create or replace function public.reserve_ai_tokens(
  p_uid uuid,
  p_tokens bigint,
  p_limit bigint
)
returns table (
  reservation_id uuid,
  usage_date date,
  tokens_used bigint,
  reserved_tokens bigint,
  allowed boolean,
  remaining bigint,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  today date := (now() at time zone 'utc')::date;
  current_used bigint;
  current_reserved bigint;
  new_reservation_id uuid;
begin
  if p_uid is null or p_tokens is null or p_tokens <= 0 or p_limit is null or p_limit <= 0 then
    raise exception 'invalid usage reservation';
  end if;

  insert into public.ai_usage_daily (uid, usage_date)
  values (p_uid, today)
  on conflict (uid, usage_date) do nothing;

  select u.tokens_used, u.reserved_tokens
    into current_used, current_reserved
    from public.ai_usage_daily u
   where u.uid = p_uid and u.usage_date = today
   for update;

  if current_used + current_reserved + p_tokens > p_limit then
    return query
      select null::uuid,
             today,
             current_used,
             current_reserved,
             false,
             greatest(p_limit - current_used - current_reserved, 0),
             ((today + 1)::timestamp at time zone 'utc');
    return;
  end if;

  new_reservation_id := gen_random_uuid();
  update public.ai_usage_daily
     set reserved_tokens = current_reserved + p_tokens,
         updated_at = now()
   where uid = p_uid and usage_date = today;

  insert into public.ai_usage_reservations (id, uid, usage_date, reserved_tokens)
  values (new_reservation_id, p_uid, today, p_tokens);

  return query
    select new_reservation_id,
           today,
           current_used,
           current_reserved + p_tokens,
           true,
           greatest(p_limit - current_used - current_reserved - p_tokens, 0),
           ((today + 1)::timestamp at time zone 'utc');
end;
$$;

create or replace function public.reconcile_ai_tokens(
  p_uid uuid,
  p_reservation_id uuid,
  p_actual bigint,
  p_limit bigint
)
returns table (
  usage_date date,
  tokens_used bigint,
  reserved_tokens bigint,
  remaining bigint,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_uid uuid;
  reservation_date date;
  reservation_tokens bigint;
  reservation_status text;
  current_used bigint;
  current_reserved bigint;
  next_used bigint;
  next_reserved bigint;
begin
  if p_uid is null or p_reservation_id is null or p_actual is null or p_actual < 0 or p_limit is null or p_limit <= 0 then
    raise exception 'invalid usage reconciliation';
  end if;

  select r.uid, r.usage_date, r.reserved_tokens, r.status
    into reservation_uid, reservation_date, reservation_tokens, reservation_status
    from public.ai_usage_reservations r
   where r.id = p_reservation_id
   for update;

  if not found or reservation_uid <> p_uid then
    raise exception 'usage reservation not found';
  end if;

  select u.tokens_used, u.reserved_tokens
    into current_used, current_reserved
    from public.ai_usage_daily u
   where u.uid = reservation_uid and u.usage_date = reservation_date
   for update;

  if not found then
    raise exception 'usage counter not found';
  end if;

  -- A retry or duplicate stream finalizer is a no-op after the reservation
  -- reached a terminal state, preventing double charging or over-release.
  if reservation_status <> 'pending' then
    return query
      select reservation_date,
             current_used,
             current_reserved,
             greatest(p_limit - current_used - current_reserved, 0),
             ((reservation_date + 1)::timestamp at time zone 'utc');
    return;
  end if;

  if current_reserved < reservation_tokens then
    raise exception 'usage reservation balance is inconsistent';
  end if;

  next_reserved := current_reserved - reservation_tokens;
  next_used := current_used + p_actual;
  if next_used + next_reserved > p_limit then
    raise exception 'actual usage exceeds daily allowance';
  end if;

  update public.ai_usage_daily
     set tokens_used = next_used,
         reserved_tokens = next_reserved,
         updated_at = now()
   where uid = reservation_uid and usage_date = reservation_date;

  update public.ai_usage_reservations
     set actual_tokens = p_actual,
         status = 'settled',
         settled_at = now()
   where id = p_reservation_id;

  return query
    select reservation_date,
           next_used,
           next_reserved,
           greatest(p_limit - next_used - next_reserved, 0),
           ((reservation_date + 1)::timestamp at time zone 'utc');
end;
$$;

create or replace function public.release_ai_tokens(
  p_uid uuid,
  p_reservation_id uuid,
  p_limit bigint
)
returns table (
  usage_date date,
  tokens_used bigint,
  reserved_tokens bigint,
  remaining bigint,
  reset_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reservation_uid uuid;
  reservation_date date;
  reservation_tokens bigint;
  reservation_status text;
  current_used bigint;
  current_reserved bigint;
  next_reserved bigint;
begin
  if p_uid is null or p_reservation_id is null or p_limit is null or p_limit <= 0 then
    raise exception 'invalid usage release';
  end if;

  select r.uid, r.usage_date, r.reserved_tokens, r.status
    into reservation_uid, reservation_date, reservation_tokens, reservation_status
    from public.ai_usage_reservations r
   where r.id = p_reservation_id
   for update;

  if not found or reservation_uid <> p_uid then
    raise exception 'usage reservation not found';
  end if;

  select u.tokens_used, u.reserved_tokens
    into current_used, current_reserved
    from public.ai_usage_daily u
   where u.uid = reservation_uid and u.usage_date = reservation_date
   for update;

  if not found then
    raise exception 'usage counter not found';
  end if;

  if reservation_status <> 'pending' then
    return query
      select reservation_date,
             current_used,
             current_reserved,
             greatest(p_limit - current_used - current_reserved, 0),
             ((reservation_date + 1)::timestamp at time zone 'utc');
    return;
  end if;

  if current_reserved < reservation_tokens then
    raise exception 'usage reservation balance is inconsistent';
  end if;

  next_reserved := current_reserved - reservation_tokens;
  update public.ai_usage_daily
     set reserved_tokens = next_reserved,
         updated_at = now()
   where uid = reservation_uid and usage_date = reservation_date;

  update public.ai_usage_reservations
     set actual_tokens = 0,
         status = 'released',
         settled_at = now()
   where id = p_reservation_id;

  return query
    select reservation_date,
           current_used,
           next_reserved,
           greatest(p_limit - current_used - next_reserved, 0),
           ((reservation_date + 1)::timestamp at time zone 'utc');
end;
$$;

revoke all on function public.reserve_ai_tokens(uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.reconcile_ai_tokens(uuid, uuid, bigint, bigint) from public, anon, authenticated;
revoke all on function public.release_ai_tokens(uuid, uuid, bigint) from public, anon, authenticated;
grant execute on function public.reserve_ai_tokens(uuid, bigint, bigint) to service_role;
grant execute on function public.reconcile_ai_tokens(uuid, uuid, bigint, bigint) to service_role;
grant execute on function public.release_ai_tokens(uuid, uuid, bigint) to service_role;

comment on table public.ai_usage_daily is 'Server-enforced per-user AI token accounting keyed by UTC date; browser access is denied.';
comment on table public.ai_usage_reservations is 'Exactly-once server-side AI token reservations and settlements.';
