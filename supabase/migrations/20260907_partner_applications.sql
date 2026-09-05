-- Public "become a partner" applications. Admin-reviewed only: the owner
-- reviews each application and creates the referral partner manually.
-- Apply after 20260906_partner_dashboard.sql. Idempotent.

create table if not exists public.partner_applications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  whatsapp text,
  note text,
  status text not null default 'new' check (status = 'new'),
  created_at timestamptz not null default now()
);

alter table public.partner_applications enable row level security;
-- No policies and no browser grants: inserts come from the server route
-- (service role), reads and deletes are owner-only admin routes.

comment on table public.partner_applications is 'Self-serve partner applications awaiting owner review.';
