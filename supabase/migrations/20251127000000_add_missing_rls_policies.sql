-- Add RLS policies for tables created after initial RLS migration
-- This ensures true multi-tenant data isolation

-- Enable RLS on all new tables
ALTER TABLE org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_acceptances ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- org_subscriptions policies
DROP POLICY IF EXISTS "Users can view their organization's subscription" ON org_subscriptions;
CREATE POLICY "Users can view their organization's subscription"
  ON org_subscriptions FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update their organization's subscription" ON org_subscriptions;
CREATE POLICY "Users can update their organization's subscription"
  ON org_subscriptions FOR UPDATE
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert their organization's subscription" ON org_subscriptions;
CREATE POLICY "Users can insert their organization's subscription"
  ON org_subscriptions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- legal_acceptances policies
DROP POLICY IF EXISTS "Users can view legal acceptances in their organization" ON legal_acceptances;
CREATE POLICY "Users can view legal acceptances in their organization"
  ON legal_acceptances FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create legal acceptances in their organization" ON legal_acceptances;
CREATE POLICY "Users can create legal acceptances in their organization"
  ON legal_acceptances FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users can update their own legal acceptances" ON legal_acceptances;
CREATE POLICY "Users can update their own legal acceptances"
  ON legal_acceptances FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND user_id = auth.uid()
  );

-- audit_logs policies
DROP POLICY IF EXISTS "Users can view audit logs in their organization" ON audit_logs;
CREATE POLICY "Users can view audit logs in their organization"
  ON audit_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create audit logs in their organization" ON audit_logs;
CREATE POLICY "Users can create audit logs in their organization"
  ON audit_logs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Note: audit_logs should be immutable (no UPDATE/DELETE policies)
-- This ensures compliance and prevents tampering

-- organization_invites policies
DROP POLICY IF EXISTS "Users can view invites in their organization" ON organization_invites;
CREATE POLICY "Users can view invites in their organization"
  ON organization_invites FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create invites in their organization" ON organization_invites;
CREATE POLICY "Users can create invites in their organization"
  ON organization_invites FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can update invites in their organization" ON organization_invites;
CREATE POLICY "Users can update invites in their organization"
  ON organization_invites FOR UPDATE
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete invites in their organization" ON organization_invites;
CREATE POLICY "Users can delete invites in their organization"
  ON organization_invites FOR DELETE
  USING (organization_id = get_user_organization_id());

-- report_snapshots policies
DROP POLICY IF EXISTS "Users can view report snapshots in their organization" ON report_snapshots;
CREATE POLICY "Users can view report snapshots in their organization"
  ON report_snapshots FOR SELECT
  USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can create report snapshots in their organization" ON report_snapshots;
CREATE POLICY "Users can create report snapshots in their organization"
  ON report_snapshots FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can delete report snapshots in their organization" ON report_snapshots;
CREATE POLICY "Users can delete report snapshots in their organization"
  ON report_snapshots FOR DELETE
  USING (organization_id = get_user_organization_id());

-- device_tokens policies (user-specific, but scoped to organization)
DROP POLICY IF EXISTS "Users can view their own device tokens" ON device_tokens;
CREATE POLICY "Users can view their own device tokens"
  ON device_tokens FOR SELECT
  USING (
    user_id = auth.uid()
    AND organization_id = get_user_organization_id()
  );

DROP POLICY IF EXISTS "Users can create their own device tokens" ON device_tokens;
CREATE POLICY "Users can create their own device tokens"
  ON device_tokens FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND organization_id = get_user_organization_id()
  );

DROP POLICY IF EXISTS "Users can delete their own device tokens" ON device_tokens;
CREATE POLICY "Users can delete their own device tokens"
  ON device_tokens FOR DELETE
  USING (
    user_id = auth.uid()
    AND organization_id = get_user_organization_id()
  );

-- refresh_tokens policies (user-specific)
DROP POLICY IF EXISTS "Users can view their own refresh tokens" ON refresh_tokens;
CREATE POLICY "Users can view their own refresh tokens"
  ON refresh_tokens FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own refresh tokens" ON refresh_tokens;
CREATE POLICY "Users can create their own refresh tokens"
  ON refresh_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own refresh tokens" ON refresh_tokens;
CREATE POLICY "Users can delete their own refresh tokens"
  ON refresh_tokens FOR DELETE
  USING (user_id = auth.uid());

-- Ensure subscriptions table has proper RLS (if not already covered)
-- Double-check that subscriptions policies exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' 
    AND policyname = 'Users can view subscriptions in their organization'
  ) THEN
    DROP POLICY IF EXISTS "Users can view subscriptions in their organization" ON subscriptions;
    CREATE POLICY "Users can view subscriptions in their organization"
      ON subscriptions FOR SELECT
      USING (organization_id = get_user_organization_id());
  END IF;
END $$;

-- Add UPDATE policy for subscriptions if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' 
    AND policyname = 'Users can update subscriptions in their organization'
  ) THEN
    CREATE POLICY "Users can update subscriptions in their organization"
      ON subscriptions FOR UPDATE
      USING (organization_id = get_user_organization_id());
  END IF;
END $$;

-- Add INSERT policy for subscriptions if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'subscriptions' 
    AND policyname = 'Users can create subscriptions in their organization'
  ) THEN
    CREATE POLICY "Users can create subscriptions in their organization"
      ON subscriptions FOR INSERT
      WITH CHECK (organization_id = get_user_organization_id());
  END IF;
END $$;

