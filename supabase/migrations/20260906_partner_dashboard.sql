-- Partner dashboard: per-partner private access token and referral click tracking.
-- Apply after 20260905_security_fixes.sql. Idempotent.

alter table public.referral_partners add column if not exists dashboard_token text;

alter table public.referral_partners add column if not exists click_count integer not null default 0;

alter table public.referral_partners add column if not exists last_clicked_at timestamptz;

create unique index if not exists referral_partners_dashboard_token_uidx
  on public.referral_partners (dashboard_token)
  where dashboard_token is not null;

comment on column public.referral_partners.dashboard_token is 'Secret bearer token for the partner''s private dashboard URL. Only the account owner should see or share it.';
comment on column public.referral_partners.click_count is 'Approximate count of referral-link visits/captures for the partner dashboard.';
comment on column public.referral_partners.last_clicked_at is 'Most recent referral-link visit.';
