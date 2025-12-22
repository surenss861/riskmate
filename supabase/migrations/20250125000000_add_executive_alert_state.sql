-- Create executive_alert_state table to prevent alert spam
-- Tracks when alerts were last sent and prevents duplicate sends within cooldown period
CREATE TABLE IF NOT EXISTS executive_alert_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  alert_key TEXT NOT NULL, -- e.g., 'INTEGRITY_ERROR', 'VIOLATIONS_PRESENT', 'HIGH_RISK_SPIKE', 'ATTESTATIONS_OVERDUE'
  last_sent_at TIMESTAMPTZ,
  last_payload_hash TEXT, -- SHA-256 hash of alert payload to detect changes
  cooldown_minutes INTEGER DEFAULT 360, -- 6 hours default cooldown
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One state per org + alert type
  UNIQUE(organization_id, alert_key)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_executive_alert_state_org_key 
  ON executive_alert_state(organization_id, alert_key);

CREATE INDEX IF NOT EXISTS idx_executive_alert_state_org 
  ON executive_alert_state(organization_id);

-- RLS policies
ALTER TABLE executive_alert_state ENABLE ROW LEVEL SECURITY;

-- Service role can manage alert state (for cron jobs)
CREATE POLICY "Service role can manage alert state"
  ON executive_alert_state
  FOR ALL
  USING (auth.role() = 'service_role');

-- Organization owners/admins can read their alert state
CREATE POLICY "Owners and admins can read alert state"
  ON executive_alert_state
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.organization_id = executive_alert_state.organization_id
      AND users.role IN ('owner', 'admin')
    )
  );

COMMENT ON TABLE executive_alert_state IS 'Tracks alert state to prevent spam and duplicate notifications';
COMMENT ON COLUMN executive_alert_state.alert_key IS 'Alert type identifier (INTEGRITY_ERROR, VIOLATIONS_PRESENT, etc.)';
COMMENT ON COLUMN executive_alert_state.last_payload_hash IS 'SHA-256 hash of last alert payload to detect changes';
COMMENT ON COLUMN executive_alert_state.cooldown_minutes IS 'Minimum minutes between identical alerts (default 360 = 6 hours)';

