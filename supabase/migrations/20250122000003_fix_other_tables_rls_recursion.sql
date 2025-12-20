-- Fix other tables that query organization_members in their RLS policies
-- This prevents RLS recursion errors when accessing these tables

-- Templates policies (line ~515-526 in comprehensive_schema_restructure.sql)
DROP POLICY IF EXISTS "Users can view templates in their organization" ON templates;
DROP POLICY IF EXISTS "Admins can manage templates in their organization" ON templates;

CREATE POLICY "Users can view templates in their organization"
  ON templates FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Admins can manage templates in their organization"
  ON templates FOR ALL
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  );

-- API Keys policies (line ~535-551 in comprehensive_schema_restructure.sql)
DROP POLICY IF EXISTS "Admins can view API keys in their organization" ON api_keys;
DROP POLICY IF EXISTS "Admins can manage API keys in their organization" ON api_keys;

CREATE POLICY "Admins can view API keys in their organization"
  ON api_keys FOR SELECT
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  );

CREATE POLICY "Admins can manage API keys in their organization"
  ON api_keys FOR ALL
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  );

-- Notifications policies (if they exist and use organization_members)
-- Note: Check if notifications table has policies that query organization_members
-- If not, this will just be a no-op (DROP POLICY IF EXISTS handles it gracefully)

