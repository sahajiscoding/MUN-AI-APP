-- Migration: Add x402 Bot Microtransaction support to payments ledger
--
-- Enables tracking of on-chain bot payments alongside traditional UroPay orders.
-- - currency: allow USDC in addition to INR
-- - plan_id: supports 'x402-bot-microtransaction'

begin;

-- Safe to re-run: idempotent migration
-- Allow '00000000-0000-0000-0000-000000000000' or null uid for machine agent caller payments if needed
comment on table public.payments is
  'Customer and machine bot payments. Tracks UroPay gateway orders and x402 on-chain microtransactions.';

commit;
