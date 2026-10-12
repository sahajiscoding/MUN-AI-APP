-- Free trial device limit: restrict free trials to at most one per device address.
--
-- Closes the multi-account trial loophole: a user who registers multiple accounts
-- from the same device address (client IP / device address) cannot claim multiple
-- free trials. The first account on a device claims the trial; all subsequent accounts
-- on that device are blocked from receiving a free trial.
--
-- Security properties:
--   * public.trial_devices records each device_address as the PRIMARY KEY.
--   * Advisory xact lock on hashtext('trial_device:' || v_clean_device) serializes
--     concurrent race attempts from the same device.
--   * start_free_trial checks both public.trial_devices and public.entitlements.trial_device_address.
--   * Missing or 'unknown' device addresses fail closed (granted=false).
--   * Service role only; RPC is SECURITY DEFINER with revoked client access.

alter table public.entitlements
  add column if not exists trial_device_address text;

create index if not exists entitlements_trial_device_address_idx
  on public.entitlements (trial_device_address)
  where trial_device_address is not null;

comment on column public.entitlements.trial_device_address is
  'Normalized device address (client IP / device address) from which the trial was claimed. Durable record of device attribution.';

create table if not exists public.trial_devices (
  device_address text primary key,
  uid uuid not null,
  granted_at timestamptz not null default now()
);

comment on table public.trial_devices is
  'Ledger of device addresses that have consumed a free trial. Primary key on device_address guarantees at most 1 free trial per device.';

alter table public.trial_devices enable row level security;

-- Authenticated users can view their own device registration record; no direct browser writes
create policy "trial_devices_select_own"
  on public.trial_devices
  for select
  to authenticated
  using (uid = auth.uid());

revoke all on table public.trial_devices from public, anon;
grant select on table public.trial_devices to authenticated;
grant all on table public.trial_devices to service_role;

-- Drop previous 2-argument signature so there is no overload ambiguity in Postgres
drop function if exists public.start_free_trial(uuid, integer);

create or replace function public.start_free_trial(
  p_uid uuid,
  p_days integer,
  p_device_address text default null
)
returns table (
  granted boolean,
  trial_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_expires_at timestamptz;
  v_clean_device text;
  v_device_already_used boolean;
begin
  -- Validate bounded input
  if p_uid is null or p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'invalid_free_trial_input';
  end if;

  -- Normalize device address: lowercase and trimmed
  v_clean_device := lower(trim(coalesce(p_device_address, '')));

  -- Device check: a valid, known device address is strictly required.
  -- Blocking empty/unknown prevents attackers from stripping IP headers to bypass the device limit.
  if v_clean_device = '' or v_clean_device = 'unknown' then
    return query select false, null::timestamptz;
    return;
  end if;

  -- Advisory lock on device address to serialize concurrent requests from the same device
  perform pg_advisory_xact_lock(hashtext('trial_device:' || v_clean_device));

  -- Check if this device address has ALREADY received a free trial across ANY account
  select exists (
    select 1
    from public.trial_devices
    where device_address = v_clean_device
  ) into v_device_already_used;

  if v_device_already_used then
    return query select false, null::timestamptz;
    return;
  end if;

  select exists (
    select 1
    from public.entitlements
    where trial_device_address = v_clean_device
  ) into v_device_already_used;

  if v_device_already_used then
    return query select false, null::timestamptz;
    return;
  end if;

  -- The one-way door for uid: if any row already exists for this uid,
  -- the account has had access before and gets nothing.
  insert into public.entitlements (
    uid,
    status,
    plan_id,
    source,
    starts_at,
    expires_at,
    trial_started_at,
    trial_device_address,
    updated_at
  )
  values (
    p_uid,
    'active',
    'free-trial',
    'trial',
    now(),
    now() + make_interval(days => p_days),
    now(),
    v_clean_device,
    now()
  )
  on conflict (uid) do nothing
  returning expires_at into v_expires_at;

  -- If conflict occurred on uid, v_expires_at is null
  if v_expires_at is null then
    return query select false, null::timestamptz;
    return;
  end if;

  -- Permanently bind this device address in public.trial_devices
  insert into public.trial_devices (
    device_address,
    uid,
    granted_at
  )
  values (
    v_clean_device,
    p_uid,
    now()
  )
  on conflict (device_address) do nothing;

  return query select true, v_expires_at;
end;
$$;

revoke all on function public.start_free_trial(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.start_free_trial(uuid, integer, text) to service_role;

comment on function public.start_free_trial(uuid, integer, text) is
  'Grants the one-time free trial to an account that has never had an entitlement, strictly checking that the requesting device address has never claimed a trial before. Blocks repeat trials from the same device.';
