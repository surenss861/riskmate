-- Fix RLS recursion by creating SECURITY DEFINER helper functions
-- These functions bypass RLS, preventing infinite recursion in policies

-- Helper function: Check if current user is a member of an organization
CREATE OR REPLACE FUNCTION public.is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = org_id
      AND om.user_id = auth.uid()
  );
$$;

-- Lock it down
REVOKE ALL ON FUNCTION public.is_org_member(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID) TO authenticated;

-- Helper function: Get current user's role in an organization
CREATE OR REPLACE FUNCTION public.org_role(org_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.role
  FROM public.organization_members om
  WHERE om.organization_id = org_id
    AND om.user_id = auth.uid()
  LIMIT 1;
$$;

-- Lock it down
REVOKE ALL ON FUNCTION public.org_role(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.org_role(UUID) TO authenticated;

-- Now fix organization_members policies to use these helpers (no recursion)

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view members in their organization" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage members in their organization" ON organization_members;

-- SELECT policy: Users can see members of organizations they belong to
CREATE POLICY "Users can view members in their organization"
  ON organization_members FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id()
    OR public.is_org_member(organization_id)
  );

-- INSERT/UPDATE/DELETE policy: Only admins/owners can manage members
CREATE POLICY "Admins can manage members in their organization"
  ON organization_members FOR ALL
  TO authenticated
  USING (
    organization_id = get_user_organization_id()
    AND public.org_role(organization_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND public.org_role(organization_id) IN ('owner', 'admin')
  );

-- Fix sites policies to use the helper (they were already partially fixed, but let's use the new helpers)
DROP POLICY IF EXISTS "Users can view sites from their organization" ON sites;
DROP POLICY IF EXISTS "Owners and admins can create sites" ON sites;
DROP POLICY IF EXISTS "Owners and admins can update sites" ON sites;
DROP POLICY IF EXISTS "Owners and admins can delete sites" ON sites;

CREATE POLICY "Users can view sites from their organization"
  ON sites FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

CREATE POLICY "Owners and admins can create sites"
  ON sites FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  );

CREATE POLICY "Owners and admins can update sites"
  ON sites FOR UPDATE
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  )
  WITH CHECK (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  );

CREATE POLICY "Owners and admins can delete sites"
  ON sites FOR DELETE
  TO authenticated
  USING (
    public.is_org_member(organization_id)
    AND public.org_role(organization_id) IN ('owner', 'admin')
  );

