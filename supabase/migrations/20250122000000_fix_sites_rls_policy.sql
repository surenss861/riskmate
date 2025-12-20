-- Fix sites RLS policy to use SECURITY DEFINER helper functions to avoid recursion
-- This migration is now superseded by 20250122000002_fix_rls_recursion_with_security_definer_helpers.sql
-- which provides proper is_org_member() and org_role() helpers
-- Keeping this file for reference but policies will be recreated in the later migration

-- Note: The proper fix uses is_org_member() and org_role() SECURITY DEFINER functions
-- that are defined in 20250122000002_fix_rls_recursion_with_security_definer_helpers.sql

