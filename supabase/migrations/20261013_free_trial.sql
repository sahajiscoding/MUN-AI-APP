-- Free trial: three days of access granted automatically to a new account.
--
-- Grant-once semantics are the whole point of this migration. The trial is
-- recorded by the EXISTENCE of a row in public.entitlements, and this function
-- only ever inserts when no row exists for that uid. That single rule closes
-- the abuse loop that would otherwise make the trial unlimited and free
-- forever: a user cannot let the trial expire and collect another one, and
-- cannot delete or reset the marker, because:
--
--   * entitlements.uid is the PRIMARY KEY, so the insert races safely;
--   * the row is written only by SECURITY DEFINER functions, and
--     `revoke all ... from public, anon, authenticated` keeps direct writes
--     and the RPC itself out of reach of a signed-in browser;
--   * expired rows are never deleted (getEntitlement only reads them), so the
--     marker outlives the access it granted.
--
-- A paid grant later UPDATEs this same row, so the marker survives conversion.
-- `trial_started_at` is therefore the durable record of "this account has had
-- its trial", independently of whatever plan_id is current afterwards.

alter table public.entitlements
  add column if not exists trial_started_at timestamptz;

comment on column public.entitlements.trial_started_at is
  'Set once, when the free trial was granted. Never cleared, so it remains the durable record that this account has consumed its trial even after a paid grant replaces plan_id/source.';

create or replace function public.start_free_trial(
  p_uid uuid,
  p_days integer
)
-- NOTE: the second OUT parameter is deliberately NOT called `expires_at`.
-- An OUT parameter of that name shadows the column inside the function body,
-- which makes `returning expires_at` ambiguous. Renaming it keeps every
-- reference to `expires_at` unambiguously the table column.
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
begin
  -- Bounded on purpose: a caller passing 3650 would hand out a decade of free
  -- access through a code path that is meant to hand out three days.
  if p_uid is null or p_days is null or p_days < 1 or p_days > 30 then
    raise exception 'invalid_free_trial_input';
  end if;

  insert into public.entitlements (
    uid,
    status,
    plan_id,
    source,
    starts_at,
    expires_at,
    trial_started_at,
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
    now()
  )
  -- The one-way door. If any row already exists for this uid the account has
  -- had access before — trial, paid, or expired — and gets nothing.
  on conflict (uid) do nothing
  returning expires_at into v_expires_at;

  if v_expires_at is null then
    return query select false, null::timestamptz;
    return;
  end if;

  return query select true, v_expires_at;
end;
$$;

revoke all on function public.start_free_trial(uuid, integer) from public, anon, authenticated;
grant execute on function public.start_free_trial(uuid, integer) to service_role;

comment on function public.start_free_trial(uuid, integer) is
  'Grants the one-time free trial to an account that has never had an entitlement. Returns granted=false (and changes nothing) when a row already exists, which is what makes the trial non-repeatable.';
