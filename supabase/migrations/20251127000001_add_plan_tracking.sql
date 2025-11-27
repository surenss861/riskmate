-- Plan tracking table to store user plan information and history
CREATE TABLE IF NOT EXISTS plan_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter', 'pro', 'business')),
  previous_plan_code TEXT CHECK (previous_plan_code IN ('starter', 'pro', 'business')),
  event_type TEXT NOT NULL, -- 'view', 'switch_initiated', 'switch_success', 'switch_failed', 'checkout_redirected'
  is_upgrade BOOLEAN,
  is_downgrade BOOLEAN,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_plan_tracking_org_created_at 
  ON plan_tracking (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_tracking_user_created_at 
  ON plan_tracking (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_tracking_plan_code 
  ON plan_tracking (plan_code);

CREATE INDEX IF NOT EXISTS idx_plan_tracking_event_type 
  ON plan_tracking (event_type);

-- Enable RLS
ALTER TABLE plan_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view plan tracking in their organization" ON plan_tracking;
CREATE POLICY "Users can view plan tracking in their organization"
  ON plan_tracking FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert plan tracking in their organization" ON plan_tracking;
CREATE POLICY "Users can insert plan tracking in their organization"
  ON plan_tracking FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
  );

-- Add current_plan column to users table for quick access
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS current_plan TEXT CHECK (current_plan IN ('starter', 'pro', 'business'));

CREATE INDEX IF NOT EXISTS idx_users_current_plan 
  ON users (current_plan);

-- Function to update user's current_plan when subscription changes
CREATE OR REPLACE FUNCTION update_user_current_plan()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all users in the organization with the new plan
  UPDATE users
  SET current_plan = NEW.tier
  WHERE organization_id = NEW.organization_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for org_subscriptions trigger
CREATE OR REPLACE FUNCTION update_user_current_plan_from_org_sub()
RETURNS TRIGGER AS $$
BEGIN
  -- Update all users in the organization with the new plan
  UPDATE users
  SET current_plan = NEW.plan_code
  WHERE organization_id = NEW.organization_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically update user's current_plan when subscription changes
DROP TRIGGER IF EXISTS trigger_update_user_current_plan ON subscriptions;
CREATE TRIGGER trigger_update_user_current_plan
  AFTER INSERT OR UPDATE OF tier ON subscriptions
  FOR EACH ROW
  WHEN (NEW.tier IS NOT NULL)
  EXECUTE FUNCTION update_user_current_plan();

-- Also update when org_subscriptions changes
DROP TRIGGER IF EXISTS trigger_update_user_current_plan_from_org_sub ON org_subscriptions;
CREATE TRIGGER trigger_update_user_current_plan_from_org_sub
  AFTER INSERT OR UPDATE OF plan_code ON org_subscriptions
  FOR EACH ROW
  WHEN (NEW.plan_code IS NOT NULL)
  EXECUTE FUNCTION update_user_current_plan_from_org_sub();

-- Backfill current_plan for existing users
UPDATE users u
SET current_plan = COALESCE(
  (SELECT tier FROM subscriptions s WHERE s.organization_id = u.organization_id ORDER BY created_at DESC LIMIT 1),
  (SELECT plan_code FROM org_subscriptions os WHERE os.organization_id = u.organization_id),
  (SELECT subscription_tier FROM organizations o WHERE o.id = u.organization_id),
  'starter'
)
WHERE current_plan IS NULL;

