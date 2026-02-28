-- Cooldown must be based only on actual sent alerts. last_alert_at = "when we last sent an email".
-- Make last_alert_at nullable so "never alerted" is explicit; remove default so new/updated state
-- does not pretend an alert was already sent.
ALTER TABLE webhook_endpoint_alert_state
  ALTER COLUMN last_alert_at DROP DEFAULT,
  ALTER COLUMN last_alert_at DROP NOT NULL;

COMMENT ON COLUMN webhook_endpoint_alert_state.last_alert_at IS 'Set only after an admin alert email is successfully sent; NULL means never alerted. Cooldown applies only when this is non-null.';
