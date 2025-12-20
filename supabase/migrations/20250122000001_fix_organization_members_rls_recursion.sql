-- Fix organization_members RLS policy to prevent infinite recursion
-- The policy was querying organization_members from within an organization_members policy
-- Solution: Use SECURITY DEFINER helper function that bypasses RLS

-- The helper function is already created in 20250122000000_fix_sites_rls_policy.sql
-- This migration fixes the organization_members policy to use it

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can manage members in their organization" ON organization_members;

-- Recreate using SECURITY DEFINER helper function (prevents recursion)
CREATE POLICY "Admins can manage members in their organization"
  ON organization_members FOR ALL
  USING (
    organization_id = get_user_organization_id()
    AND is_current_user_admin()
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND is_current_user_admin()
  );

