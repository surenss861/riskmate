-- Terminal outcome reason for webhook deliveries so paused/cancelled deliveries
-- are not counted as failures in stats or UI.

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS terminal_outcome text;

COMMENT ON COLUMN webhook_deliveries.terminal_outcome IS
  'Reason for terminal state: delivered, failed, cancelled_paused, cancelled_policy. Null = in-progress or legacy.';

-- Constrain to allowed values (optional; allows NULL for backward compatibility)
ALTER TABLE webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_terminal_outcome_check;
ALTER TABLE webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_terminal_outcome_check
  CHECK (terminal_outcome IS NULL OR terminal_outcome IN ('delivered', 'failed', 'cancelled_paused', 'cancelled_policy'));
