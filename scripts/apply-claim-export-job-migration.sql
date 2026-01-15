-- ============================================================================
-- Apply claim_export_job Migration
-- ============================================================================
-- Copy and paste this ENTIRE file into Supabase SQL Editor and run it.
-- This creates the RPC function needed by the export worker.

-- ============================================================================
-- Option 1: RPC Function for Atomic Claiming (Recommended)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_export_job(p_max_concurrent INTEGER DEFAULT 3)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  work_record_id UUID,
  export_type TEXT,
  filters JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claimed_job RECORD;
BEGIN
  -- Find and claim one queued job using FOR UPDATE SKIP LOCKED
  -- This ensures only one worker can claim a job at a time
  SELECT 
    e.id,
    e.organization_id,
    e.work_record_id,
    e.export_type,
    e.filters,
    e.created_by,
    e.created_at,
    NOW() as started_at
  INTO claimed_job
  FROM exports e
  WHERE e.state = 'queued'
    AND (
      -- Check concurrent limit: count how many are currently being processed
      SELECT COUNT(*) 
      FROM exports e2 
      WHERE e2.organization_id = e.organization_id
        AND e2.state IN ('preparing', 'generating', 'uploading')
    ) < p_max_concurrent
  ORDER BY e.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If we found a job, update its state atomically
  IF claimed_job.id IS NOT NULL THEN
    UPDATE exports
    SET 
      state = 'preparing',
      started_at = NOW()
    WHERE id = claimed_job.id
      AND state = 'queued'; -- Optimistic locking: only update if still queued

    -- Return the claimed job
    RETURN QUERY SELECT 
      claimed_job.id,
      claimed_job.organization_id,
      claimed_job.work_record_id,
      claimed_job.export_type,
      claimed_job.filters,
      claimed_job.created_by,
      claimed_job.created_at,
      claimed_job.started_at;
  END IF;

  -- No job available
  RETURN;
END;
$$;

-- Add comment
COMMENT ON FUNCTION public.claim_export_job IS 'Atomically claims one queued export job using FOR UPDATE SKIP LOCKED. Prevents race conditions when multiple workers are running.';

-- Grant execute permission to authenticated users (backend uses service role)
GRANT EXECUTE ON FUNCTION public.claim_export_job(INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_export_job(INTEGER) TO service_role;

-- ============================================================================
-- Option 2: Index for Efficient Claiming
-- ============================================================================

-- Index for efficient queued job selection
CREATE INDEX IF NOT EXISTS idx_exports_queued_claim 
ON exports (state, created_at) 
WHERE state = 'queued';

-- Index for concurrent limit check
CREATE INDEX IF NOT EXISTS idx_exports_processing_count
ON exports (organization_id, state)
WHERE state IN ('preparing', 'generating', 'uploading');

-- ============================================================================
-- Refresh PostgREST Schema Cache
-- ============================================================================
-- This makes the function immediately available to PostgREST/Supabase API

SELECT pg_notify('pgrst', 'reload schema');

-- ============================================================================
-- Verify Function Was Created
-- ============================================================================
-- Run this after applying the migration to confirm it worked:

SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'claim_export_job';

-- Expected result:
-- schema | function_name     | args
-- -------|-------------------|------------------
-- public | claim_export_job  | p_max_concurrent integer DEFAULT 3
