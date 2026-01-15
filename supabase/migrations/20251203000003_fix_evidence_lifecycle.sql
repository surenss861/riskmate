-- Fix Evidence Table: Add missing lifecycle fields and improve constraints

-- ============================================================================
-- 1. ADD MISSING EVIDENCE LIFECYCLE FIELDS
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evidence') THEN
    -- Add captured_at (when photo was taken, not when uploaded)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'evidence' AND column_name = 'captured_at') THEN
      ALTER TABLE evidence ADD COLUMN captured_at TIMESTAMPTZ;
    END IF;
    
    -- Add content_type alias for mime_type (for consistency)
    -- Keep mime_type as primary, content_type as computed
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'evidence' AND column_name = 'content_type') THEN
      ALTER TABLE evidence ADD COLUMN content_type TEXT;
      -- Backfill from mime_type
      UPDATE evidence SET content_type = mime_type WHERE content_type IS NULL;
    END IF;
    
    -- Add bytes field (file size in bytes, alias for file_size)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'evidence' AND column_name = 'bytes') THEN
      ALTER TABLE evidence ADD COLUMN bytes BIGINT;
      -- Backfill from file_size
      UPDATE evidence SET bytes = file_size WHERE bytes IS NULL;
    END IF;
    
    -- Add tag field (evidence_type alias, for consistency)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'evidence' AND column_name = 'tag') THEN
      ALTER TABLE evidence ADD COLUMN tag TEXT;
      -- Backfill from evidence_type
      UPDATE evidence SET tag = evidence_type WHERE tag IS NULL;
    END IF;
  END IF;
END $$;

-- ============================================================================
-- 2. FIX EVIDENCE IDEMPOTENCY (should be per org, not per org+job)
-- ============================================================================

-- Current: UNIQUE(organization_id, evidence_id, state) - allows same evidence_id in different states
-- Better: UNIQUE(organization_id, idempotency_key) - prevents any duplicate upload
-- Keep evidence_id for client reference, but idempotency_key is the dedupe key

-- The existing UNIQUE(organization_id, idempotency_key) is correct
-- Remove the evidence_id+state unique if it causes issues (evidence_id is just a client ref)

-- ============================================================================
-- 3. ADD INDEXES FOR EVIDENCE QUERIES
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'evidence') THEN
    -- Index for listing evidence by job
    CREATE INDEX IF NOT EXISTS idx_evidence_org_job_created 
      ON evidence(organization_id, work_record_id, created_at DESC);
    
    -- Index for state-based queries (upload queue)
    CREATE INDEX IF NOT EXISTS idx_evidence_org_state_created 
      ON evidence(organization_id, state, created_at DESC) 
      WHERE state IN ('queued', 'uploading', 'failed');
    
    -- Index for phase queries
    CREATE INDEX IF NOT EXISTS idx_evidence_org_phase 
      ON evidence(organization_id, phase) 
      WHERE phase IS NOT NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. ADD COMMENTS
-- ============================================================================

COMMENT ON COLUMN evidence.captured_at IS 'Timestamp when photo/evidence was captured (may differ from created_at)';
COMMENT ON COLUMN evidence.content_type IS 'MIME type alias (same as mime_type)';
COMMENT ON COLUMN evidence.bytes IS 'File size in bytes (alias for file_size)';
COMMENT ON COLUMN evidence.tag IS 'Evidence type tag (alias for evidence_type)';
