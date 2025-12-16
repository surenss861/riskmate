-- Add archive and delete timestamps to jobs table
-- This enables proper soft deletion and archiving for audit compliance

DO $$
BEGIN
  -- Add archived_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'archived_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN archived_at TIMESTAMPTZ;
  END IF;

  -- Add deleted_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN deleted_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for filtering active jobs (not archived, not deleted)
CREATE INDEX IF NOT EXISTS idx_jobs_active 
ON jobs(organization_id, created_at DESC) 
WHERE archived_at IS NULL AND deleted_at IS NULL;

-- Create index for archived jobs
CREATE INDEX IF NOT EXISTS idx_jobs_archived 
ON jobs(organization_id, archived_at DESC) 
WHERE archived_at IS NOT NULL;

-- Comment on columns for documentation
COMMENT ON COLUMN jobs.archived_at IS 'Timestamp when job was archived. Archived jobs are read-only and preserved for audit compliance.';
COMMENT ON COLUMN jobs.deleted_at IS 'Timestamp when job was soft-deleted. Deleted jobs are permanently removed from active views but preserved in database for audit trail.';

