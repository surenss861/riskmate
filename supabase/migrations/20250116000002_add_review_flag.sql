-- Add review_flag column to jobs table
-- This enables governance signals for jobs requiring oversight

DO $$
BEGIN
  -- Add review_flag column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'review_flag'
  ) THEN
    ALTER TABLE jobs ADD COLUMN review_flag BOOLEAN DEFAULT FALSE;
  END IF;

  -- Add flagged_at timestamp if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'jobs' AND column_name = 'flagged_at'
  ) THEN
    ALTER TABLE jobs ADD COLUMN flagged_at TIMESTAMPTZ;
  END IF;
END $$;

-- Create index for filtering flagged jobs
CREATE INDEX IF NOT EXISTS idx_jobs_review_flag 
ON jobs(organization_id, flagged_at DESC) 
WHERE review_flag = TRUE;

-- Comment on columns for documentation
COMMENT ON COLUMN jobs.review_flag IS 'Governance signal: job requires oversight from Safety Lead or executive. Creates visibility, not workflow.';
COMMENT ON COLUMN jobs.flagged_at IS 'Timestamp when job was flagged for review. Used for audit trail and visibility sorting.';

