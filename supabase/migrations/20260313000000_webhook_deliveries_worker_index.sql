-- Composite partial index for worker's hot query: pending, unclaimed, ready-to-retry deliveries.
-- Matches processPendingDeliveries() filter so Postgres can use the index instead of full-table scan.
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_worker ON webhook_deliveries(next_retry_at, attempt_count)
  WHERE delivered_at IS NULL AND processing_since IS NULL AND next_retry_at IS NOT NULL;
