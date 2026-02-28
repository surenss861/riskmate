-- Track consecutive terminal failures per endpoint; alert only when count reaches threshold.
ALTER TABLE webhook_endpoint_alert_state
  ADD COLUMN IF NOT EXISTS consecutive_failures INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN webhook_endpoint_alert_state.consecutive_failures IS 'Incremented on each terminal delivery failure; reset on success. Admin alert sent when this reaches 5.';
