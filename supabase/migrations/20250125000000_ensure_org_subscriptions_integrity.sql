-- Ensure org_subscriptions has proper constraints and is the single source of truth
-- This migration ensures data integrity for iOS ↔ web parity

-- 1) Ensure org_subscriptions has PRIMARY KEY constraint (one row per org)
-- This should already exist, but we'll verify and add if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conrelid = 'org_subscriptions'::regclass 
    AND conname = 'org_subscriptions_pkey'
  ) THEN
    ALTER TABLE org_subscriptions
      ADD CONSTRAINT org_subscriptions_pkey PRIMARY KEY (organization_id);
  END IF;
END $$;

-- 2) Remove any duplicate rows (keep the most recent one)
DELETE FROM org_subscriptions
WHERE ctid NOT IN (
  SELECT MIN(ctid)
  FROM org_subscriptions
  GROUP BY organization_id
);

-- 3) Ensure cancel_at_period_end column exists
ALTER TABLE org_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- 4) Ensure status column includes 'none' and 'inactive' (if not already done)
ALTER TABLE org_subscriptions
  DROP CONSTRAINT IF EXISTS org_subscriptions_status_check;

ALTER TABLE org_subscriptions
  ADD CONSTRAINT org_subscriptions_status_check
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'inactive'));

-- 5) Ensure plan_code includes 'none' (if not already done)
ALTER TABLE org_subscriptions
  DROP CONSTRAINT IF EXISTS org_subscriptions_plan_code_check;

ALTER TABLE org_subscriptions
  ADD CONSTRAINT org_subscriptions_plan_code_check
    CHECK (plan_code IN ('none', 'starter', 'pro', 'business'));

-- 6) Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_org_id ON org_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_status ON org_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_org_subscriptions_plan_code ON org_subscriptions(plan_code);

-- 7) Add comment documenting this as the source of truth
COMMENT ON TABLE org_subscriptions IS 'Single source of truth for organization subscription state. Used by both iOS and web apps. One row per organization.';
