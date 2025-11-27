-- Fix plan_tracking table: rename user_id to actor_id if it exists
-- This handles the case where the table was created before we changed the column name

DO $$
BEGIN
  -- Check if plan_tracking table exists and has user_id column
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'plan_tracking' 
    AND column_name = 'user_id'
  ) THEN
    -- Rename user_id to actor_id
    ALTER TABLE plan_tracking RENAME COLUMN user_id TO actor_id;
    
    -- Update the index name if it exists
    IF EXISTS (
      SELECT 1 FROM pg_indexes 
      WHERE indexname = 'idx_plan_tracking_user_created_at'
    ) THEN
      DROP INDEX IF EXISTS idx_plan_tracking_user_created_at;
      CREATE INDEX IF NOT EXISTS idx_plan_tracking_actor_created_at 
        ON plan_tracking (actor_id, created_at DESC);
    END IF;
  END IF;
END $$;

-- Ensure the table structure is correct (in case it doesn't exist or was partially created)
CREATE TABLE IF NOT EXISTS plan_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_code TEXT NOT NULL CHECK (plan_code IN ('starter', 'pro', 'business')),
  previous_plan_code TEXT CHECK (previous_plan_code IN ('starter', 'pro', 'business')),
  event_type TEXT NOT NULL,
  is_upgrade BOOLEAN,
  is_downgrade BOOLEAN,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure actor_id column exists (add if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'plan_tracking' 
    AND column_name = 'actor_id'
  ) THEN
    ALTER TABLE plan_tracking ADD COLUMN actor_id UUID REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_plan_tracking_org_created_at 
  ON plan_tracking (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_tracking_actor_created_at 
  ON plan_tracking (actor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_plan_tracking_plan_code 
  ON plan_tracking (plan_code);

CREATE INDEX IF NOT EXISTS idx_plan_tracking_event_type 
  ON plan_tracking (event_type);

-- Update RLS policies to use actor_id
DROP POLICY IF EXISTS "Users can view plan tracking in their organization" ON plan_tracking;
CREATE POLICY "Users can view plan tracking in their organization"
  ON plan_tracking FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert plan tracking in their organization" ON plan_tracking;
CREATE POLICY "Users can insert plan tracking in their organization"
  ON plan_tracking FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND (actor_id IS NULL OR actor_id = auth.uid())
  );

