-- Add team_events table for tracking team access changes
-- This enables enterprise-grade audit trails for access & accountability

CREATE TABLE IF NOT EXISTS team_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  target_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  target_invite_id UUID REFERENCES organization_invites(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_team_events_org_id ON team_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_events_actor_id ON team_events(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_events_target_user ON team_events(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_events_type ON team_events(event_type, created_at DESC);

-- RLS policies
ALTER TABLE team_events ENABLE ROW LEVEL SECURITY;

-- Users can view team events for their organization
CREATE POLICY "Users can view org team events"
  ON team_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.organization_id = team_events.organization_id
    )
  );

-- Service role can insert (for backend logging)
CREATE POLICY "Service role can insert team events"
  ON team_events FOR INSERT
  WITH CHECK (true);

COMMENT ON TABLE team_events IS 'Audit log for team access changes (invites, role changes, access revocation)';
COMMENT ON COLUMN team_events.event_type IS 'Category: invite_sent, invite_accepted, role_changed, access_revoked';
COMMENT ON COLUMN team_events.event_name IS 'Specific event: team.invite_sent, team.role_changed, etc.';

