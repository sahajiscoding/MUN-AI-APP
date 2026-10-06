-- Migration: Webhook Event Claim Recovery and Idempotency States
--
-- Formalizes webhook_events claim lifecycle:
-- - 'processing': Event claimed by active delivery (lease protected)
-- - 'processed': Event fully processed, payment updated, entitlements granted
-- - 'failed': Delivery encountered retryable error, safe to reclaim
-- - 'received': Initial received state for backward compatibility

begin;

-- Ensure index for stale lease lookup and claim recovery
create index if not exists webhook_events_status_updated_idx
  on public.webhook_events (status, updated_at);

comment on column public.webhook_events.status is
  'Claim lifecycle status: processing (active lease), processed (completed), failed (eligible for retry claim), or received.';

commit;
