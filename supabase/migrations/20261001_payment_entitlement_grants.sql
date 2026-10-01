-- Durable per-payment entitlement idempotency.
--
-- Deploy order: apply this migration together with (or before) the matching
-- application code. Older code keeps working against the rewritten RPC; newer
-- code that reads the ledger degrades gracefully until the table exists.
--
-- The entitlement row's latest_payment_id is only a pointer to the most recent
-- payment. It cannot prevent an older paid order from being replayed after a
-- newer grant replaces that pointer. This ledger is the durable source of truth.
--
-- Existing paid orders are conservatively marked as already consumed because
-- the old schema cannot distinguish previously granted orders from paid orders
-- whose grant failed. Any genuinely unfulfilled pre-migration payment must be
-- reviewed first; an owner can then release one specific payment for a single
-- recovery with:
--   delete from public.entitlement_payment_grants where payment_id = '<uuid>';
-- (only after confirming the user never received access for it).

begin;

-- Legacy payment rows may store 'weekly'/'monthly' while the app grants
-- 'weekly-pass'/'monthly-pass' (lib/plans.ts canonicalPlanId). Compare the
-- canonical forms so old rows stay eligible.
create or replace function public.canonical_plan_id(p_plan_id text)
returns text
language sql
immutable
set search_path = public, pg_temp
as $$
  select case p_plan_id
    when 'weekly' then 'weekly-pass'
    when 'monthly' then 'monthly-pass'
    else p_plan_id
  end;
$$;

revoke all on function public.canonical_plan_id(text) from public, anon, authenticated;
grant execute on function public.canonical_plan_id(text) to service_role;

create table if not exists public.entitlement_payment_grants (
  payment_id uuid primary key references public.payments(id) on delete cascade,
  uid uuid not null references auth.users(id) on delete cascade,
  plan_id text not null,
  order_id text,
  source text not null,
  granted_at timestamptz not null default now()
);

alter table public.entitlement_payment_grants enable row level security;
revoke all on table public.entitlement_payment_grants from public, anon, authenticated;
grant all on table public.entitlement_payment_grants to service_role;

comment on table public.entitlement_payment_grants is
  'Durable idempotency ledger: a provider payment can extend an entitlement at most once.';

-- Fail closed for legacy paid rows whose prior grant history cannot be proven.
insert into public.entitlement_payment_grants (payment_id, uid, plan_id, order_id, source, granted_at)
select
  p.id,
  p.uid,
  p.plan_id,
  coalesce(p.uropay_order_id, p.order_ref),
  'legacy-paid-payment',
  coalesce(p.updated_at, p.created_at, now())
from public.payments p
where lower(p.status) = 'paid'
on conflict (payment_id) do nothing;

create or replace function public.grant_entitlement_atomic(
  p_uid uuid,
  p_plan_id text,
  p_source text,
  p_access_days integer,
  p_payment_id uuid,
  p_order_id text
)
returns table (
  uid uuid,
  status text,
  plan_id text,
  source text,
  latest_payment_id text,
  latest_order_id text,
  starts_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row public.entitlements%rowtype;
  v_payment public.payments%rowtype;
  v_existing_uid uuid;
  v_claimed_payment_id uuid;
  v_key bigint;
begin
  if p_uid is null or p_plan_id is null or p_source is null
     or p_access_days is null or p_access_days <= 0 or p_access_days > 3650 then
    raise exception 'invalid_entitlement_input';
  end if;

  -- Serialize entitlement changes for a user, including the first grant.
  v_key := hashtextextended('mun:ent:' || p_uid::text, 0);
  perform pg_advisory_xact_lock(v_key);
  select * into v_row from public.entitlements where entitlements.uid = p_uid for update;

  if p_payment_id is not null then
    -- A payment id is valid only for its owning user, plan, and confirmed paid
    -- row. Callers still verify the provider; this guards internal misuse too.
    select * into v_payment
      from public.payments
     where payments.id = p_payment_id
     for share;
    if not found
       or v_payment.uid <> p_uid
       or public.canonical_plan_id(v_payment.plan_id) <> public.canonical_plan_id(p_plan_id)
       or lower(v_payment.status) <> 'paid' then
      raise exception 'payment_not_eligible_for_entitlement';
    end if;

    select grant_row.uid into v_existing_uid
      from public.entitlement_payment_grants grant_row
     where grant_row.payment_id = p_payment_id
     for update;

    if found then
      if v_existing_uid <> p_uid then
        raise exception 'payment_entitlement_uid_mismatch';
      end if;
      if v_row.uid is not null then
        return query select
          v_row.uid, v_row.status, v_row.plan_id, v_row.source,
          v_row.latest_payment_id, v_row.latest_order_id,
          v_row.starts_at, v_row.expires_at, v_row.updated_at;
      end if;
      return;
    end if;

    insert into public.entitlement_payment_grants (
      payment_id, uid, plan_id, order_id, source
    ) values (
      p_payment_id, p_uid, p_plan_id, p_order_id, p_source
    )
    on conflict (payment_id) do nothing
    returning payment_id into v_claimed_payment_id;

    -- A concurrent grant may have won the unique-key race. It must not extend
    -- the entitlement a second time.
    if v_claimed_payment_id is null then
      if v_row.uid is not null then
        return query select
          v_row.uid, v_row.status, v_row.plan_id, v_row.source,
          v_row.latest_payment_id, v_row.latest_order_id,
          v_row.starts_at, v_row.expires_at, v_row.updated_at;
      end if;
      return;
    end if;
  end if;

  if v_row.uid is not null then
    update public.entitlements
       set status = 'active',
           plan_id = p_plan_id,
           source = p_source,
           latest_payment_id = p_payment_id::text,
           latest_order_id = p_order_id,
           starts_at = now(),
           expires_at = case
             when v_row.status = 'active'
              and v_row.expires_at is not null
              and v_row.expires_at > now()
               then v_row.expires_at + make_interval(days => p_access_days)
             else now() + make_interval(days => p_access_days)
           end,
           updated_at = now()
     where entitlements.uid = p_uid
     returning * into v_row;
  else
    insert into public.entitlements (
      uid, status, plan_id, source, latest_payment_id, latest_order_id,
      starts_at, expires_at, updated_at
    ) values (
      p_uid, 'active', p_plan_id, p_source, p_payment_id::text, p_order_id,
      now(), now() + make_interval(days => p_access_days), now()
    ) returning * into v_row;
  end if;

  return query select
    v_row.uid, v_row.status, v_row.plan_id, v_row.source,
    v_row.latest_payment_id, v_row.latest_order_id,
    v_row.starts_at, v_row.expires_at, v_row.updated_at;
end;
$$;

revoke all on function public.grant_entitlement_atomic(uuid, text, text, integer, uuid, text)
  from public, anon, authenticated;
grant execute on function public.grant_entitlement_atomic(uuid, text, text, integer, uuid, text)
  to service_role;

commit;
