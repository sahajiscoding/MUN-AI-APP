-- Security follow-up: atomic referral click counting and partner dashboard token TTL.

alter table public.referral_partners
  add column if not exists dashboard_token_expires_at timestamptz;

-- Make referral click counting atomic even while older application code
-- performs a read-then-write update. The trigger derives the new count from
-- the current stored value while the row is locked by PostgreSQL.
create or replace function public.bump_referral_click_counter()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.last_clicked_at is distinct from old.last_clicked_at then
    new.click_count := coalesce(old.click_count, 0) + 1;
  end if;
  return new;
end;
$$;

revoke execute on function public.bump_referral_click_counter() from public, anon, authenticated;
grant execute on function public.bump_referral_click_counter() to service_role;

drop trigger if exists referral_partners_atomic_click_counter on public.referral_partners;
create trigger referral_partners_atomic_click_counter
before update on public.referral_partners
for each row
when (new.last_clicked_at is distinct from old.last_clicked_at)
execute function public.bump_referral_click_counter();

-- Cap dashboard bearer links at 30 days. This database-enforced boundary
-- protects production even if an older application build still requests a
-- longer expiry.
create or replace function public.enforce_partner_dashboard_token_ttl()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.dashboard_token is distinct from old.dashboard_token then
    new.dashboard_token_expires_at := least(
      coalesce(new.dashboard_token_expires_at, now() + interval '30 days'),
      now() + interval '30 days'
    );
  end if;
  return new;
end;
$$;

revoke execute on function public.enforce_partner_dashboard_token_ttl() from public, anon, authenticated;
grant execute on function public.enforce_partner_dashboard_token_ttl() to service_role;

drop trigger if exists referral_partners_dashboard_token_ttl on public.referral_partners;
create trigger referral_partners_dashboard_token_ttl
before update on public.referral_partners
for each row
when (new.dashboard_token is distinct from old.dashboard_token)
execute function public.enforce_partner_dashboard_token_ttl();

-- Clamp existing bearer tokens as well. Existing links are not immediately
-- invalidated; their maximum remaining lifetime is now 30 days.
update public.referral_partners
set dashboard_token_expires_at = least(
  coalesce(dashboard_token_expires_at, now() + interval '30 days'),
  now() + interval '30 days'
),
updated_at = now()
where dashboard_token is not null
  and (dashboard_token_expires_at is null or dashboard_token_expires_at > now() + interval '30 days');
