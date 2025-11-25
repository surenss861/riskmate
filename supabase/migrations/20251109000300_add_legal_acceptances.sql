-- Legal acceptance tracking per user & organization
CREATE TABLE IF NOT EXISTS legal_acceptances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  version TEXT NOT NULL,
  ip_address TEXT,
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_acceptances_user_version
  ON legal_acceptances (user_id, version);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_org
  ON legal_acceptances (organization_id, accepted_at DESC);

