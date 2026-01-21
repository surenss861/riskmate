-- Add Alert Deduplication Support
-- Prevents duplicate alerts for the same condition

-- Add alert_key column for deduplication
ALTER TABLE billing_alerts 
ADD COLUMN IF NOT EXISTS alert_key TEXT;

-- Add index for alert_key lookups
CREATE INDEX IF NOT EXISTS idx_billing_alerts_key ON billing_alerts(alert_key) WHERE alert_key IS NOT NULL;

-- Add unique constraint on alert_key + resolved (only one unresolved alert per key)
-- Note: This allows multiple resolved alerts with same key (for history)
-- But only one unresolved alert per key
CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_alerts_key_unresolved 
ON billing_alerts(alert_key) 
WHERE alert_key IS NOT NULL AND resolved = false;

COMMENT ON COLUMN billing_alerts.alert_key IS 'Deterministic key for deduplication (e.g., "reconcile_stale", "high_severity_stale")';
