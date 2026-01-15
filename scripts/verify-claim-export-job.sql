-- ============================================================================
-- Verify claim_export_job RPC Function
-- ============================================================================
-- Run this in Supabase SQL Editor to verify the function exists and matches
-- the expected signature used by the export worker.

-- Check if function exists and get its signature
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS return_type
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'claim_export_job';

-- Expected result:
-- schema | function_name     | args                                    | return_type
-- -------|-------------------|-----------------------------------------|------------------
-- public | claim_export_job  | p_max_concurrent integer DEFAULT 3     | TABLE(...)

-- ============================================================================
-- If function doesn't exist, apply the migration:
-- supabase/migrations/20251203000004_export_worker_atomic_claim.sql
-- ============================================================================

-- ============================================================================
-- After creating/verifying function, refresh PostgREST schema cache:
-- ============================================================================
SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================================
-- Verify the function works (test call):
-- ============================================================================
-- This should return 0 rows if no queued exports, or 1 row if a job is claimed
SELECT * FROM claim_export_job(3);
