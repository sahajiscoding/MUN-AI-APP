-- Security hardening migration for referral integrity and entitlement concurrency.
-- Apply after 20260826_hardened_data_contract.sql and 20260826_referral_system.sql.
-- All functions are service-role only; browser roles receive no execute privilege.

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
begin
  if p_uid is null or p_plan_id is null or p_source is null
     or p_access_days is null or p_access_days <= 0 or p_access_days > 3650 then
    raise exception 'invalid_entitlement_input';
  end if;

  return query
  insert into public.entitlements (
    uid,
    status,
    plan_id,
    source,
    latest_payment_id,
    latest_order_id,
    starts_at,
    expires_at,
    updated_at
  )
  values (
    p_uid,
    'active',
    p_plan_id,
    p_source,
    p_payment_id::text,
    p_order_id,
    now(),
    now() + make_interval(days => p_access_days),
    now()
  )
  on conflict (uid) do update
  set status = 'active',
      plan_id = excluded.plan_id,
      source = excluded.source,
      latest_payment_id = excluded.latest_payment_id,
      latest_order_id = excluded.latest_order_id,
      starts_at = excluded.starts_at,
      expires_at = case
        when public.entitlements.status = 'active'
          and public.entitlements.expires_at is not null
          and public.entitlements.expires_at > excluded.starts_at
          then public.entitlements.expires_at + make_interval(days => p_access_days)
        else excluded.starts_at + make_interval(days => p_access_days)
      end,
      updated_at = excluded.updated_at
  returning
    entitlements.uid,
    entitlements.status,
    entitlements.plan_id,
    entitlements.source,
    entitlements.latest_payment_id,
    entitlements.latest_order_id,
    entitlements.starts_at,
    entitlements.expires_at,
    entitlements.updated_at;
end;
$$;

revoke all on function public.grant_entitlement_atomic(uuid, text, text, integer, uuid, text) from public, anon, authenticated;
grant execute on function public.grant_entitlement_atomic(uuid, text, text, integer, uuid, text) to service_role;

-- One first-purchase commission per referred customer. A partner can have
-- unlimited converted referrals, one for each distinct referred_uid.
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

  -- Lock only this customer’s attribution row. Different customers referred
  -- by the same partner can settle concurrently without blocking each other.
  select * into v_referral
  from public.referrals
  where referred_uid = p_uid
  for update;

  if not found then
    return query select false, 'no_referral'::text, null::uuid, null::numeric;
    return;
  end if;

  if v_referral.status <> 'registered' then
    return query select false, 'already_converted'::text, null::uuid, null::numeric;
    return;
  end if;

  select commission_rate into v_commission_rate
  from public.referral_partners
  where id = v_referral.partner_id
    and status = 'active';

  if v_commission_rate is null then
    raise exception 'referral_partner_not_active';
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
  on conflict do nothing
  returning id into v_commission_id;

  if v_commission_id is null then
    -- This covers a safe recovery from a previously inserted ledger row.
    update public.referrals
    set status = 'converted',
        first_payment_id = coalesce(first_payment_id, v_payment.id),
        first_order_id = coalesce(first_order_id, p_order_id, v_payment.uropay_order_id, v_payment.order_ref),
        converted_at = coalesce(converted_at, now()),
        updated_at = now()
    where id = v_referral.id
      and status = 'registered';

    return query select false, 'already_processed'::text, null::uuid, null::numeric;
    return;
  end if;

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

-- The existing unique(payment_id) constraint remains the defense against
-- duplicate delivery of the same payment. The locked referral status above
-- prevents later payments from the same customer creating another commission.
notify pgrst, 'reload schema';
