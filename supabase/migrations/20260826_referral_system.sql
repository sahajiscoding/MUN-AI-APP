-- noqa: disable=all
-- MUN Prep referral and commission system.
-- Apply after 20260826_hardened_data_contract.sql.
-- All referral data is server-side only; no browser policies are created.

create extension if not exists pgcrypto;

create table if not exists public.referral_partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  whatsapp text,
  referral_code text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended')),
  commission_rate numeric(5,2) not null default 16.72
    check (commission_rate >= 0 and commission_rate <= 100),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  referred_uid uuid not null references auth.users(id) on delete cascade,
  referral_code text not null,
  status text not null default 'registered'
    check (status in ('registered', 'converted', 'cancelled')),
  first_payment_id uuid references public.payments(id) on delete set null,
  first_order_id text,
  converted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (referred_uid)
);

create table if not exists public.referral_commissions (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.referral_partners(id) on delete cascade,
  referral_id uuid not null references public.referrals(id) on delete cascade,
  payment_id uuid references public.payments(id) on delete set null,
  order_id text,
  plan_id text not null,
  payment_amount numeric(10,2) not null check (payment_amount >= 0),
  commission_rate numeric(5,2) not null default 16.72
    check (commission_rate >= 0 and commission_rate <= 100),
  commission_amount numeric(10,2) not null check (commission_amount >= 0),
  status text not null default 'unpaid'
    check (status in ('unpaid', 'paid', 'cancelled')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id)
);

-- Compatibility for installations where the tables were created from an
-- earlier draft without the newer optional columns or constraints.
alter table public.referral_partners add column if not exists whatsapp text;
alter table public.referral_partners add column if not exists status text default 'pending';
alter table public.referral_partners add column if not exists commission_rate numeric(5,2) default 16.72;
alter table public.referral_partners add column if not exists notes text;
alter table public.referral_partners add column if not exists created_at timestamptz default now();
alter table public.referral_partners add column if not exists updated_at timestamptz default now();
alter table public.referrals add column if not exists status text default 'registered';
alter table public.referrals add column if not exists first_payment_id uuid;
alter table public.referrals add column if not exists first_order_id text;
alter table public.referrals add column if not exists converted_at timestamptz;
alter table public.referrals add column if not exists created_at timestamptz default now();
alter table public.referrals add column if not exists updated_at timestamptz default now();
alter table public.referral_commissions add column if not exists payment_id uuid;
alter table public.referral_commissions add column if not exists order_id text;
alter table public.referral_commissions add column if not exists commission_rate numeric(5,2) default 16.72;
alter table public.referral_commissions add column if not exists status text default 'unpaid';
alter table public.referral_commissions add column if not exists paid_at timestamptz;
alter table public.referral_commissions add column if not exists notes text;
alter table public.referral_commissions add column if not exists created_at timestamptz default now();
alter table public.referral_commissions add column if not exists updated_at timestamptz default now();

create index if not exists referral_partners_code_idx on public.referral_partners (referral_code);
create index if not exists referrals_partner_idx on public.referrals (partner_id);
create index if not exists referrals_user_idx on public.referrals (referred_uid);
create index if not exists referrals_status_idx on public.referrals (status);
create index if not exists referral_commissions_partner_idx on public.referral_commissions (partner_id);
create index if not exists referral_commissions_status_idx on public.referral_commissions (status);
create unique index if not exists referral_commissions_payment_uidx
  on public.referral_commissions (payment_id)
  where payment_id is not null;
create index if not exists payments_uid_status_idx on public.payments (uid, status);

alter table public.referral_partners enable row level security;
alter table public.referrals enable row level security;
alter table public.referral_commissions enable row level security;

comment on table public.referral_partners is 'Admin-managed referral partners; server-side access only.';
comment on table public.referrals is 'First-touch customer attribution keyed by Supabase Auth UID.';
comment on table public.referral_commissions is 'Verified successful-payment commission ledger; payouts are manual only.';
