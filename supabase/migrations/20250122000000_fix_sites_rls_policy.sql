-- Fix sites RLS policy to use get_user_organization_id() instead of organization_members
-- This matches the pattern used in all other tables and prevents SQL errors

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view sites from their organization" ON sites;
DROP POLICY IF EXISTS "Owners and admins can create sites" ON sites;
DROP POLICY IF EXISTS "Owners and admins can update sites" ON sites;
DROP POLICY IF EXISTS "Owners and admins can delete sites" ON sites;

-- Recreate policies using get_user_organization_id() (consistent with other tables)
CREATE POLICY "Users can view sites from their organization"
  ON sites FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Owners and admins can create sites"
  ON sites FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND organization_id = get_user_organization_id()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can update sites"
  ON sites FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND organization_id = get_user_organization_id()
      AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND organization_id = get_user_organization_id()
      AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Owners and admins can delete sites"
  ON sites FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
      AND organization_id = get_user_organization_id()
      AND role IN ('owner', 'admin')
    )
  );

