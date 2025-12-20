-- Fix sites RLS policy to use SECURITY DEFINER helper functions to avoid recursion
-- Direct queries to users table in policies can cause infinite recursion with organization_members

-- Create SECURITY DEFINER helper functions to prevent RLS recursion
-- These functions bypass RLS, preventing infinite recursion in policies

-- Get current user's role (bypasses RLS)
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM users WHERE id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if current user is admin in their organization (bypasses RLS)
CREATE OR REPLACE FUNCTION is_current_user_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role IN ('owner', 'admin')
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view sites from their organization" ON sites;
DROP POLICY IF EXISTS "Owners and admins can create sites" ON sites;
DROP POLICY IF EXISTS "Owners and admins can update sites" ON sites;
DROP POLICY IF EXISTS "Owners and admins can delete sites" ON sites;

-- Recreate policies using SECURITY DEFINER functions (prevents recursion)
CREATE POLICY "Users can view sites from their organization"
  ON sites FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Owners and admins can create sites"
  ON sites FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_current_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "Owners and admins can update sites"
  ON sites FOR UPDATE
  USING (
    organization_id = get_user_organization_id()
    AND get_current_user_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    organization_id = get_user_organization_id()
    AND get_current_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "Owners and admins can delete sites"
  ON sites FOR DELETE
  USING (
    organization_id = get_user_organization_id()
    AND get_current_user_role() IN ('owner', 'admin')
  );

