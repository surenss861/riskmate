-- Team & seat management

CREATE TABLE IF NOT EXISTS organization_invites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE organization_invites
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS organization_invites_unique_email
  ON organization_invites (organization_id, lower(email))
  WHERE accepted_at IS NULL AND revoked_at IS NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN DEFAULT FALSE;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS org_subscriptions (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter', 'pro', 'business')),
  seats_limit INTEGER,
  jobs_limit_month INTEGER,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE org_subscriptions
  ADD COLUMN IF NOT EXISTS seats_limit INTEGER;

UPDATE org_subscriptions
SET seats_limit = CASE
  WHEN plan_code = 'starter' THEN COALESCE(seats_limit, 1)
  WHEN plan_code = 'pro' THEN COALESCE(seats_limit, 5)
  ELSE seats_limit
END
WHERE seats_limit IS NULL;

ALTER TABLE org_subscriptions
  ALTER COLUMN seats_limit SET DEFAULT 1;

