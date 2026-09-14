-- Security fixes from the full-site review.
-- Apply after 20260904_course_progress.sql. Idempotent where possible.
--
-- Includes:
--   1. Shared DB-backed rate limiting (works across serverless instances).
--   2. Per-user daily AI usage ledger.
--   3. Admin audit log.
--   4. RLS tightening: remove direct client writes on users/delegate_profiles/
--      research_notes/course_progress and revoke course_progress client grants.
--   5. course_progress.quiz_verified_at for server-graded final reviews.
--   6. grant_entitlement_atomic rewrite: advisory lock + same-payment guard
--      (prevents double-grant extending expires_at twice).
--   7. create_first_referral_commission rewrite: DB-enforced self-referral
--      guards (customer email vs partner email, and partner auth account).

-- ============================================================
-- 1. RATE LIMITING STORE
-- ============================================================

create table if not exists public.rate_limits (
  key      text primary key,
  count    integer not null default 1,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;
-- No policies: the browser roles get no grants and no access.

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

  return v_count <= p_max;
end;
$$;

revoke all on function public.rate_limit_check(text, integer, bigint) from public, anon, authenticated;
grant execute on function public.rate_limit_check(text, integer, bigint) to service_role;

-- One-off cleanup of stale rows at migration time.
delete from public.rate_limits where reset_at <= now() - interval '1 day';

-- ============================================================
-- 2. AI USAGE LEDGER (per-user daily)
-- ============================================================

create table if not exists public.ai_usage (
  uid          uuid not null references auth.users(id) on delete cascade,
  day          date not null,
  requests     integer not null default 0,
  total_tokens integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (uid, day)
);

alter table public.ai_usage enable row level security;
-- No policies and no browser grants: writes and reads are service-role only.

-- ============================================================
-- 3. ADMIN AUDIT LOG
-- ============================================================

create table if not exists public.admin_audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_uid   text,
  actor_email text,
  action      text not null,
  target_uid  text,
  target      text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
-- No policies: service-role writes only, surfaced through admin routes.

create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);

-- ============================================================
-- 4. RLS TIGHTENING ΓÇö REMOVE DIRECT CLIENT WRITES
-- ============================================================

-- users / delegate_profiles / research_notes: keep owner reads, drop client
-- inserts and updates (rows are created by the auth trigger and all writes go
-- through server routes with the service role).
drop policy if exists "users_insert_own" on public.users;
drop policy if exists "users_update_own" on public.users;
drop policy if exists "delegate_profiles_insert_own" on public.delegate_profiles;
drop policy if exists "delegate_profiles_update_own" on public.delegate_profiles;
drop policy if exists "research_notes_insert_own" on public.research_notes;
drop policy if exists "research_notes_update_own" on public.research_notes;
drop policy if exists "research_notes_delete_own" on public.research_notes;

-- course_progress: completion and quiz state must only be written by the
-- server (service role). Remove the authenticated role's write grants and
-- the insert/update policies so browser sessions cannot forge completion.
revoke all on public.course_progress from anon, authenticated;
grant all on public.course_progress to service_role;

drop policy if exists "course_progress_insert_own" on public.course_progress;
drop policy if exists "course_progress_update_own" on public.course_progress;

-- ============================================================
-- 5. COURSE PROGRESS: SERVER-VERIFIED QUIZ STATE
-- ============================================================

alter table public.course_progress add column if not exists quiz_verified_at timestamptz;

-- Backfill: rows that legitimately recorded a passing final review under the
-- previous client-graded flow (score/total >= 0.7) keep their completion once
-- certificates require a server-verified pass. quiz_verified_at is set only
-- for a genuine recorded pass and stamped with the row's own updated_at (not
-- now()) so the backfill is idempotent and re-runs never fabricate
-- verification for rows that never passed. New rows written by the grading
-- server route are unaffected; the WHERE guard keeps this from ever trusting
-- future client-supplied scores.
update public.course_progress
set quiz_verified_at = coalesce(quiz_verified_at, updated_at)
where quiz_verified_at is null
  and quiz_total > 0
  and quiz_score * 10 >= 7 * quiz_total;

-- ============================================================
-- 6. ENTITLEMENT GRANT ΓÇö RACE-FREE
-- ============================================================

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
  v_key bigint;
begin
  if p_uid is null or p_plan_id is null or p_source is null
     or p_access_days is null or p_access_days <= 0 or p_access_days > 3650 then
    raise exception 'invalid_entitlement_input';
  end if;

  -- Serialize all entitlement changes for this user. An advisory lock also
  -- works before a row exists, closing the race where two deliveries of one
  -- payment both read "not granted yet" and both extend expires_at.
  v_key := hashtextextended('mun:ent:' || p_uid::text, 0);
  perform pg_advisory_xact_lock(v_key);

  select * into v_row from public.entitlements where uid = p_uid for update;

  -- The exact same payment must never grant (or extend) access twice.
  if v_row.uid is not null and v_row.latest_payment_id = p_payment_id::text then
    return query select
      v_row.uid, v_row.status, v_row.plan_id, v_row.source,
      v_row.latest_payment_id, v_row.latest_order_id,
      v_row.starts_at, v_row.expires_at, v_row.updated_at;
    return;
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
    where uid = p_uid
    returning * into v_row;
  else
    insert into public.entitlements (
      uid, status, plan_id, source, latest_payment_id, latest_order_id,
      starts_at, expires_at, updated_at
    ) values (
      p_uid, 'active', p_plan_id, p_source, p_payment_id::text, p_order_id,
      now(), now() + make_interval(days => p_access_days), now()
    )
    returning * into v_row;
  end if;

  return query select
    v_row.uid, v_row.status, v_row.plan_id, v_row.source,
    v_row.latest_payment_id, v_row.latest_order_id,
    v_row.starts_at, v_row.expires_at, v_row.updated_at;
end;
$$;

revoke all on function public.grant_entitlement_atomic(uuid, text, text, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.grant_entitlement_atomic(uuid, text, text, integer, uuid, text) to service_role;

-- ============================================================
-- 7. REFERRAL COMMISSION ΓÇö DB-ENFORCED SELF-REFERRAL GUARDS
-- ============================================================

create or replace function public.create_first_referral_commission(
  p_uid uuid,
  p_payment_id uuid,
  p_order_id text
)
returns table (
  created boolean,
  reason text,
  commission_id uuid,
  commission_amount numeric
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_referral public.referrals%rowtype;
  v_payment public.payments%rowtype;
  v_commission_id uuid;
  v_commission_amount numeric;
  v_commission_rate numeric;
  v_partner_email text;
  v_customer_email text;
begin
  if p_uid is null or p_payment_id is null then
    raise exception 'invalid_commission_input';
  end if;

  -- Only a paid payment belonging to this exact customer may settle a referral.
  select * into v_payment
  from public.payments
  where id = p_payment_id
    and uid = p_uid
    and status = 'paid'
  for share;

  if not found then
    raise exception 'payment_not_paid_or_user_mismatch';
  end if;

  if p_order_id is not null
     and p_order_id is distinct from v_payment.order_ref
     and p_order_id is distinct from v_payment.uropay_order_id then
    raise exception 'payment_order_mismatch';
  end if;

  -- One immutable first-touch attribution row per customer.
  select * into v_referral
  from public.referrals
  where referred_uid = p_uid
  for update;

  if not found then
    return query select false, 'no_referral'::text, null::uuid, null::numeric;
    return;
  end if;

  select email, commission_rate
  into v_partner_email, v_commission_rate
  from public.referral_partners
  where id = v_referral.partner_id
    and status = 'active';

  if v_partner_email is null then
    raise exception 'referral_partner_not_active';
  end if;

  -- Self-referral guards, enforced in the database so no application bug or
  -- service-role call path can pay a partner for referring themselves.
  select email into v_customer_email
  from public.users
  where uid = p_uid;

  if v_customer_email is not null
     and lower(v_customer_email) = lower(v_partner_email) then
    return query select false, 'self_referral'::text, null::uuid, null::numeric;
    return;
  end if;

  -- The partner's own auth account (if it exists) cannot be the payer either.
  if exists (
    select 1
    from auth.users u
    where lower(coalesce(u.email, '')) = lower(v_partner_email)
      and u.id = p_uid
  ) then
    return query select false, 'self_referral'::text, null::uuid, null::numeric;
    return;
  end if;

  v_commission_amount := round(
    ((v_payment.amount::numeric / 100) * v_commission_rate / 100)::numeric,
    2
  );

  insert into public.referral_commissions (
    partner_id,
    referral_id,
    payment_id,
    order_id,
    plan_id,
    payment_amount,
    commission_rate,
    commission_amount,
    status
  )
  values (
    v_referral.partner_id,
    v_referral.id,
    v_payment.id,
    coalesce(p_order_id, v_payment.uropay_order_id, v_payment.order_ref),
    v_payment.plan_id,
    v_payment.amount::numeric / 100,
    v_commission_rate,
    v_commission_amount,
    'unpaid'
  )
  on conflict (payment_id) do nothing
  returning id into v_commission_id;

  if v_commission_id is null then
    return query select false, 'already_processed'::text, null::uuid, null::numeric;
    return;
  end if;

  -- Convert the first-touch referral once, but never overwrite its partner.
  update public.referrals
  set status = 'converted',
      first_payment_id = coalesce(first_payment_id, v_payment.id),
      first_order_id = coalesce(first_order_id, p_order_id, v_payment.uropay_order_id, v_payment.order_ref),
      converted_at = coalesce(converted_at, now()),
      updated_at = now()
  where id = v_referral.id
    and status = 'registered';

  return query select true, 'created'::text, v_commission_id, v_commission_amount;
end;
$$;

revoke all on function public.create_first_referral_commission(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.create_first_referral_commission(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
