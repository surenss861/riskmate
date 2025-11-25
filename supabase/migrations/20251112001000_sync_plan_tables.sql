-- Ensure org_subscriptions table exists for plan metadata
CREATE TABLE IF NOT EXISTS org_subscriptions (
  organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter', 'pro', 'business')),
  seats_limit INTEGER,
  jobs_limit_month INTEGER,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add status column if it doesn't exist
ALTER TABLE org_subscriptions
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- Create index (will fail silently if column doesn't exist, but we just added it above)
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON org_subscriptions(status);

-- Historical subscription snapshots (one row per org)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  tier TEXT NOT NULL CHECK (tier IN ('starter', 'pro', 'business')),
  status TEXT NOT NULL DEFAULT 'active',
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_org ON subscriptions(organization_id);

-- Normalize organizations subscription columns (allow NULL until plan selected)
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;
ALTER TABLE organizations ALTER COLUMN subscription_tier DROP DEFAULT;
ALTER TABLE organizations ALTER COLUMN subscription_tier DROP NOT NULL;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_subscription_tier_check
    CHECK (
      subscription_tier IS NULL
      OR subscription_tier IN ('starter', 'pro', 'business')
    );

ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;
ALTER TABLE organizations ALTER COLUMN subscription_status DROP DEFAULT;
ALTER TABLE organizations ALTER COLUMN subscription_status DROP NOT NULL;
ALTER TABLE organizations
  ADD CONSTRAINT organizations_subscription_status_check
    CHECK (
      subscription_status IS NULL
      OR subscription_status IN ('active', 'canceled', 'past_due', 'trialing')
    );

-- Trigger to keep subscriptions.updated_at fresh
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


