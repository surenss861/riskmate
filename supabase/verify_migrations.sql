-- Quick Verification Script for Team Removal & Account Deletion Fixes
-- Run this in Supabase SQL Editor to verify migrations are applied correctly

-- ============================================================================
-- 1. CHECK RPC FUNCTION EXISTS
-- ============================================================================
SELECT 
  CASE 
    WHEN COUNT(*) > 0 THEN '✅ RPC function remove_team_member exists'
    ELSE '❌ RPC function MISSING - apply migration 20241225000000_add_remove_team_member_rpc.sql'
  END AS rpc_status,
  COUNT(*) AS function_count
FROM pg_proc 
WHERE proname = 'remove_team_member';

-- Check it's SECURITY DEFINER
SELECT 
  proname,
  prosecdef AS is_security_definer,
  CASE 
    WHEN prosecdef = true THEN '✅ SECURITY DEFINER enabled'
    ELSE '❌ NOT SECURITY DEFINER - function will fail'
  END AS security_status
FROM pg_proc 
WHERE proname = 'remove_team_member';

-- ============================================================================
-- 2. CHECK FK CONSTRAINTS ARE CORRECT
-- ============================================================================
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS references_table,
  rc.delete_rule,
  CASE 
    WHEN rc.delete_rule IN ('SET NULL', 'CASCADE') THEN '✅'
    WHEN rc.delete_rule = 'RESTRICT' THEN '❌ Will block deletion'
    ELSE '⚠️ Check manually'
  END AS status,
  tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON rc.constraint_name = tc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('job_assignments', 'jobs', 'hazards', 'users', 'organization_invites')
  AND kcu.column_name IN ('user_id', 'created_by', 'invited_by', 'assignee_id')
  AND tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;

-- ============================================================================
-- 3. SUMMARY CHECK
-- ============================================================================
SELECT 
  'Migration Status Summary' AS check_type,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'remove_team_member') 
    THEN '✅ RPC function exists'
    ELSE '❌ RPC function MISSING'
  END AS rpc_function,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM information_schema.referential_constraints rc
      JOIN information_schema.table_constraints tc ON rc.constraint_name = tc.constraint_name
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = 'job_assignments' 
        AND kcu.column_name = 'user_id'
        AND rc.delete_rule IN ('SET NULL', 'CASCADE')
    )
    THEN '✅ FK constraints fixed'
    ELSE '❌ FK constraints need fixing'
  END AS fk_constraints;

-- ============================================================================
-- 4. TEST RPC FUNCTION (Dry Run - Won't Actually Remove)
-- ============================================================================
-- Uncomment to test function signature (replace with real UUIDs)
-- SELECT remove_team_member(
--   '00000000-0000-0000-0000-000000000000'::UUID,  -- org_id
--   '00000000-0000-0000-0000-000000000000'::UUID,  -- member_id
--   NULL::UUID  -- reassign_to
-- );

