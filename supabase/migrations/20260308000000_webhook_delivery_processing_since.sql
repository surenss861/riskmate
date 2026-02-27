-- Atomic claim for webhook delivery worker: only one tick can process a given row at a time.
ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS processing_since TIMESTAMPTZ;

COMMENT ON COLUMN webhook_deliveries.processing_since IS 'Set while worker is sending; null when idle or after update. Used for mutual exclusion and claim.';
