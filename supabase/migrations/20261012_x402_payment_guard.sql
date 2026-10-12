-- Migration: x402 one-payment-one-grant guard + machine-payment ledger fix
--
-- Closes two defects in the x402 bot-payment path.
--
-- 1) REPLAY. The reference x402 stack performs no HTTP-layer idempotency:
--    /verify is stateless and single-use is enforced only by the on-chain
--    EIP-3009 nonce. Against any facilitator that is not authoritative for
--    single-use (broadcast-only settle, `settlement_pending`, degraded RPC,
--    cache-permitting CDN), one signed payment produces N grants. This table
--    moves the "one payment = one grant" invariant into an atomic,
--    application-owned claim, so it holds regardless of facilitator behaviour.
--
--    payment_identity is derived exclusively from SIGNED material
--    (network | asset | payer | nonce) — the same tuple that is single-use
--    on chain. A PRIMARY KEY conflict is therefore the replay signal.
--
-- 2) NO LEDGER. public.payments.uid is NOT NULL REFERENCES auth.users(id),
--    but the x402 writer supplied the all-zero UUID, which is not a real auth
--    user. Every insert raised a foreign-key violation that the writer logged
--    and swallowed, so the entire x402 revenue stream had no ledger at all.
--    uid becomes nullable for machine rows only, guarded by a CHECK so human
--    payments keep a mandatory owner.
--
-- Safe to re-run.

begin;

-- ---------------------------------------------------------------
-- 1. Machine payments have no auth.users owner.
-- ---------------------------------------------------------------

alter table public.payments
  alter column uid drop not null;

-- Human payments must still be owned; only the x402 ledger row may be ownerless.
alter table public.payments
  drop constraint if exists payments_uid_or_machine;

alter table public.payments
  add constraint payments_uid_or_machine
  check (
    uid is not null
    or plan_id = 'x402-bot-microtransaction'
  );

-- UNIT NOTE for public.payments.amount, now that two rails share this table:
--   * UroPay rows store whole INR rupees (currency = 'INR').
--   * x402 rows store atomic USDC, 6 decimals (currency = 'USDC'), so a
--     $0.005 microtransaction is 5000. USDC has no "whole unit" small enough
--     for these prices, which is why the atomic unit is used instead.
-- Always filter or group by `currency` before summing `amount`.

-- ---------------------------------------------------------------
-- 2. Atomic one-grant claims
-- ---------------------------------------------------------------

create table if not exists public.x402_payment_claims (
  payment_identity  text primary key,
  resource_key      text not null,
  network           text not null,
  asset             text,
  payer             text,
  amount_atomic     text,
  transaction_hash  text,
  payment_id_hint   text,
  claimed_at        timestamptz not null default now()
);

comment on table public.x402_payment_claims is
  'Atomically claimed x402 payments. A PRIMARY KEY conflict means the signed authorization was already consumed: one payment backs at most one granted resource. Written before the resource is released, and independently of the reporting ledger.';

comment on column public.x402_payment_claims.payment_identity is
  'sha256("x402-v1|" || network || "|" || asset || "|" || payer || "|" || nonce). Derived only from cryptographically signed fields, so it cannot be forged or varied without invalidating the payment signature.';

comment on column public.x402_payment_claims.resource_key is
  'The specific resource this payment was consumed for (e.g. "course:mun-basics"). Lets the guard distinguish an honest retry from a cross-resource replay.';

-- Retention / audit queries.
create index if not exists x402_payment_claims_claimed_at_idx
  on public.x402_payment_claims (claimed_at desc);

create index if not exists x402_payment_claims_payer_idx
  on public.x402_payment_claims (payer, claimed_at desc);

-- Server-only table. No client policies exist, so anon/authenticated roles have
-- no access path; the backend secret key bypasses RLS.
alter table public.x402_payment_claims enable row level security;

drop policy if exists "x402_payment_claims_deny_all" on public.x402_payment_claims;
create policy "x402_payment_claims_deny_all"
  on public.x402_payment_claims
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

commit;
