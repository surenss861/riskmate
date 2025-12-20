-- Fix RLS recursion by creating SECURITY DEFINER helper functions
-- These functions bypass RLS, preventing infinite recursion in policies

-- Step 1: Drop all policies that depend on the old functions FIRST
-- (This must happen before we can drop the old function signatures)

-- organization_members policies
DROP POLICY IF EXISTS "Users can view members in their organization" ON organization_members;
DROP POLICY IF EXISTS "Admins can manage members in their organization" ON organization_members;
DROP POLICY IF EXISTS "organization_members_select" ON organization_members;
DROP POLICY IF EXISTS "organization_members_insert" ON organization_members;
DROP POLICY IF EXISTS "organization_members_update" ON organization_members;
DROP POLICY IF EXISTS "organization_members_delete" ON organization_members;

-- sites policies
DROP POLICY IF EXISTS "Users can view sites from their organization" ON sites;
DROP POLICY IF EXISTS "Owners and admins can create sites" ON sites;
DROP POLICY IF EXISTS "Owners and admins can update sites" ON sites;
DROP POLICY IF EXISTS "Owners and admins can delete sites" ON sites;

-- templates policies (from migration 20250122000003)
DROP POLICY IF EXISTS "Users can view templates in their organization" ON templates;
DROP POLICY IF EXISTS "Admins can manage templates in their organization" ON templates;

-- api_keys policies (from migration 20250122000003)
DROP POLICY IF EXISTS "Admins can view API keys in their organization" ON api_keys;
DROP POLICY IF EXISTS "Admins can manage API keys in their organization" ON api_keys;

-- Step 2: Now we can drop old function signatures
DROP FUNCTION IF EXISTS public.is_org_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.is_org_member(UUID, UUID) CASCADE;
DROP FUNCTION IF EXISTS public.org_role(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.org_role(UUID, UUID) CASCADE;

-- Step 3: Create new helper functions with explicit parameters
CREATE FUNCTION public.is_org_member(p_org UUID, p_user UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.organization_id = p_org
      AND om.user_id = p_user
  );
$$;

CREATE FUNCTION public.org_role(p_org UUID, p_user UUID DEFAULT auth.uid())
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT om.role::TEXT
  FROM public.organization_members om
  WHERE om.organization_id = p_org
    AND om.user_id = p_user
  LIMIT 1;
$$;

-- Step 4: Set ownership and permissions
ALTER FUNCTION public.is_org_member(UUID, UUID) OWNER TO postgres;
ALTER FUNCTION public.org_role(UUID, UUID) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.is_org_member(UUID, UUID) FROM public;
REVOKE ALL ON FUNCTION public.org_role(UUID, UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.is_org_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.org_role(UUID, UUID) TO authenticated;

-- Step 5: Now recreate policies using the new functions

-- Enable RLS if not already enabled
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Users can see members of organizations they belong to
CREATE POLICY "organization_members_select"
  ON organization_members FOR SELECT
  TO authenticated
  USING (public.is_org_member(organization_id));

-- INSERT policy: Only admins/owners can add members
CREATE POLICY "organization_members_insert"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (public.org_role(organization_id) IN ('owner', 'admin'));

-- UPDATE policy: Only admins/owners can update members
CREATE POLICY "organization_members_update"
  ON organization_members FOR UPDATE
  TO authenticated
  USING (public.org_role(organization_id) IN ('owner', 'admin'))
  WITH CHECK (public.org_role(organization_id) IN ('owner', 'admin'));

-- DELETE policy: Only admins/owners can remove members
CREATE POLICY "organization_members_delete"
  ON organization_members FOR DELETE
  TO authenticated
  USING (public.org_role(organization_id) IN ('owner', 'admin'));

-- Fix sites policies to use the helpers (prevents recursion)
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
