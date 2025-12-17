-- Add security_events table for tracking security-related actions
-- This enables enterprise-grade security audit trails

CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_org_id ON security_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type, created_at DESC);

-- RLS policies
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Users can view their own security events
CREATE POLICY "Users can view their own security events"
  ON security_events FOR SELECT
  USING (auth.uid() = user_id);

-- Organization admins/owners can view org security events
CREATE POLICY "Org admins can view org security events"
  ON security_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.organization_id = security_events.organization_id
        AND users.role IN ('owner', 'admin')
    )
  );

-- Service role can insert (for backend logging)
CREATE POLICY "Service role can insert security events"
  ON security_events FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE security_events IS 'Audit log for security-related events (password changes, 2FA, sessions, etc.)';
COMMENT ON COLUMN security_events.event_type IS 'Category: password_reset, password_change, 2fa_enabled, session_revoked, etc.';
COMMENT ON COLUMN security_events.event_name IS 'Specific event: security.password_reset_requested, security.password_changed, etc.';

