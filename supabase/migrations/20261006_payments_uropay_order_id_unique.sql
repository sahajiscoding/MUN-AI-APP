-- One provider (UroPay) order may back at most ONE local payment.
--
-- Without this, a single paid provider order could be linked to several local
-- payment rows (e.g. via the unlinked-order reconciliation path) and each of
-- them would then pass the per-payment entitlement ledger, granting access
-- more than once for one real payment.
--
-- If this migration fails with a unique violation, duplicates already exist.
-- Investigate them BEFORE re-running (do not just delete rows):
--   select uropay_order_id, array_agg(id), array_agg(uid), array_agg(status)
--     from public.payments
--    where uropay_order_id is not null
--    group by uropay_order_id
--   having count(*) > 1;

begin;

create unique index if not exists payments_uropay_order_id_uidx
  on public.payments (uropay_order_id)
  where uropay_order_id is not null;

commit;
