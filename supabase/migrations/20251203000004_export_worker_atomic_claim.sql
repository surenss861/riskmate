-- ============================================================================
-- Atomic Export Job Claiming
-- ============================================================================
-- 
-- Provides DB-atomic claiming for export jobs to prevent race conditions
-- when multiple backend instances are running.
--
-- Two approaches:
-- 1. RPC function for atomic claiming (recommended)
-- 2. Direct SQL with FOR UPDATE SKIP LOCKED (fallback)
--

-- ============================================================================
-- Option 1: RPC Function for Atomic Claiming (Recommended)
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_export_job(p_max_concurrent INTEGER DEFAULT 3)
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
COMMENT ON FUNCTION claim_export_job IS 'Atomically claims one queued export job using FOR UPDATE SKIP LOCKED. Prevents race conditions when multiple workers are running.';

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
-- Grant Permissions
-- ============================================================================

-- Allow authenticated users to call the function (backend will use service role)
-- RLS will still apply to the underlying exports table
