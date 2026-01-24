-- Add 'none' plan option and 'inactive' status for new organizations
-- New users default to "No plan" until they subscribe via Stripe

-- Add 'none' to subscription_tier CHECK constraint
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_tier_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_subscription_tier_check
  CHECK (subscription_tier IN ('none', 'starter', 'pro', 'business'));

-- Change default subscription_tier to 'none'
ALTER TABLE organizations
  ALTER COLUMN subscription_tier SET DEFAULT 'none';

-- Add 'inactive' to subscription_status CHECK constraint
ALTER TABLE organizations
  DROP CONSTRAINT IF EXISTS organizations_subscription_status_check;

ALTER TABLE organizations
  ADD CONSTRAINT organizations_subscription_status_check
  CHECK (subscription_status IN ('active', 'canceled', 'past_due', 'trialing', 'inactive'));

-- Change default subscription_status to 'inactive'
ALTER TABLE organizations
  ALTER COLUMN subscription_status SET DEFAULT 'inactive';

-- Update org_subscriptions table if it exists (add 'none' to plan_code)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'org_subscriptions'
  ) THEN
    -- Drop existing constraint if it exists
    ALTER TABLE org_subscriptions
      DROP CONSTRAINT IF EXISTS org_subscriptions_plan_code_check;
    
    -- Add new constraint with 'none'
    ALTER TABLE org_subscriptions
      ADD CONSTRAINT org_subscriptions_plan_code_check
      CHECK (plan_code IN ('none', 'starter', 'pro', 'business'));
  END IF;
END $$;

-- Update subscriptions table if it exists (add 'none' to tier)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'subscriptions'
  ) THEN
    -- Drop existing constraint if it exists
    ALTER TABLE subscriptions
      DROP CONSTRAINT IF EXISTS subscriptions_tier_check;
    
    -- Add new constraint with 'none'
    ALTER TABLE subscriptions
      ADD CONSTRAINT subscriptions_tier_check
      CHECK (tier IN ('none', 'starter', 'pro', 'business'));
  END IF;
END $$;

-- Add cancel_at_period_end to org_subscriptions if it doesn't exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'org_subscriptions'
  ) THEN
    -- Add cancel_at_period_end column if it doesn't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'org_subscriptions' 
      AND column_name = 'cancel_at_period_end'
    ) THEN
      ALTER TABLE org_subscriptions
        ADD COLUMN cancel_at_period_end BOOLEAN DEFAULT FALSE;
      
      CREATE INDEX IF NOT EXISTS idx_org_subscriptions_cancel_at_period_end 
        ON org_subscriptions (cancel_at_period_end) 
        WHERE cancel_at_period_end = true;
    END IF;
  END IF;
END $$;
