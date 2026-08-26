-- MUN-AI-APP production data contract hardening.
-- Apply with the Supabase SQL editor or Supabase CLI before enabling payments.
-- This migration is intentionally idempotent.

create extension if not exists pgcrypto;

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references auth.users(id) on delete cascade,
  tool text not null,
  provider text not null,
  model text not null,
  input_summary jsonb not null default '{}'::jsonb,
  output text not null default '',
  created_at timestamptz not null default now()
);

alter table public.ai_generations enable row level security;
create index if not exists ai_generations_uid_created_idx
  on public.ai_generations (uid, created_at desc);

-- Keep this table compatible with the application even if an older partial
-- version already exists.
alter table public.ai_generations add column if not exists uid uuid;
alter table public.ai_generations add column if not exists tool text;
alter table public.ai_generations add column if not exists provider text;
alter table public.ai_generations add column if not exists model text;
alter table public.ai_generations add column if not exists input_summary jsonb default '{}'::jsonb;
alter table public.ai_generations add column if not exists output text default '';
alter table public.ai_generations add column if not exists created_at timestamptz default now();

create table if not exists public.entitlements (
  uid uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive' check (status in ('inactive', 'active', 'expired')),
  plan_id text,
  source text,
  latest_payment_id text,
  latest_order_id text,
  starts_at timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.entitlements enable row level security;
alter table public.entitlements add column if not exists starts_at timestamptz;
alter table public.entitlements add column if not exists expires_at timestamptz;
alter table public.entitlements add column if not exists latest_payment_id text;
alter table public.entitlements add column if not exists latest_order_id text;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  uid uuid not null references auth.users(id) on delete cascade,
  order_ref text unique not null,
  uropay_order_id text,
  plan_id text not null,
  amount integer not null check (amount > 0),
  status text not null default 'pending',
  amount_captured numeric,
  commission numeric,
  transaction_fee numeric,
  tax numeric,
  net_amount numeric,
  currency text not null default 'INR',
  environment text not null default 'production',
  event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.payments enable row level security;
alter table public.payments add column if not exists id uuid default gen_random_uuid();
alter table public.payments add column if not exists uid uuid;
alter table public.payments add column if not exists order_ref text;
alter table public.payments add column if not exists uropay_order_id text;
alter table public.payments add column if not exists plan_id text;
alter table public.payments add column if not exists amount integer;
alter table public.payments add column if not exists status text default 'pending';
alter table public.payments add column if not exists amount_captured numeric;
alter table public.payments add column if not exists commission numeric;
alter table public.payments add column if not exists transaction_fee numeric;
alter table public.payments add column if not exists tax numeric;
alter table public.payments add column if not exists net_amount numeric;
alter table public.payments add column if not exists currency text default 'INR';
alter table public.payments add column if not exists environment text default 'production';
alter table public.payments add column if not exists event_id text;
alter table public.payments add column if not exists created_at timestamptz default now();
alter table public.payments add column if not exists updated_at timestamptz default now();

create unique index if not exists payments_order_ref_uidx
  on public.payments (order_ref)
  where order_ref is not null;
create index if not exists payments_uid_created_idx
  on public.payments (uid, created_at desc);

create table if not exists public.webhook_events (
  event_id text primary key,
  event text,
  status text not null default 'received',
  order_ref text,
  uropay_order_id text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.webhook_events enable row level security;
-- Existing installations may have an older webhook_events shape. Align it
-- before the handler writes provider-specific identifiers.
alter table public.webhook_events add column if not exists event text;
alter table public.webhook_events add column if not exists status text default 'received';
alter table public.webhook_events add column if not exists order_ref text;
alter table public.webhook_events add column if not exists uropay_order_id text;
alter table public.webhook_events add column if not exists received_at timestamptz default now();
alter table public.webhook_events add column if not exists updated_at timestamptz default now();
create unique index if not exists webhook_events_event_id_uidx
  on public.webhook_events (event_id);

-- A private bucket is used by the server-side service-role client. The
-- application never grants direct browser access to transcript objects.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('chat-history', 'chat-history', false, 10485760, array['application/json']::text[])
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/json']::text[];

-- Replace broad or stale policies with explicit owner-read policies. The
-- service-role key bypasses RLS for server-side writes and does not need a
-- permissive browser UPDATE policy.
drop policy if exists "ai_generations_select_own" on public.ai_generations;
create policy "ai_generations_select_own" on public.ai_generations
  for select using (auth.uid() = uid);

drop policy if exists "entitlements_select_own" on public.entitlements;
create policy "entitlements_select_own" on public.entitlements
  for select using (auth.uid() = uid);

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own" on public.payments
  for select using (auth.uid() = uid);
drop policy if exists "payments_insert_own" on public.payments;
drop policy if exists "payments_update_service" on public.payments;

drop policy if exists "webhook_events_select_own" on public.webhook_events;

-- Restrict transcript object access to the server service role. Existing
-- browser-facing Storage policies, if any, are removed for this bucket.
drop policy if exists "chat_history_read_own" on storage.objects;
drop policy if exists "chat_history_insert_own" on storage.objects;
drop policy if exists "chat_history_update_own" on storage.objects;
drop policy if exists "chat_history_delete_own" on storage.objects;

comment on table public.ai_generations is 'Durable per-user AI chat index; transcript body is stored in private chat-history Storage.';
comment on table public.webhook_events is 'Atomic UroPay webhook idempotency records keyed by provider event ID.';
