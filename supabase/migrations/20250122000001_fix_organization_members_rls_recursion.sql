-- Fix organization_members RLS policy to prevent infinite recursion
-- The policy was querying organization_members from within an organization_members policy
-- Solution: Use SECURITY DEFINER helper function that bypasses RLS

-- Ensure the helper function exists (in case it wasn't created in previous migration)
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

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

