-- Add function to compute status rank for deterministic sorting
-- This enables cursor pagination to work correctly with status_asc sorting

CREATE OR REPLACE FUNCTION get_status_rank(status TEXT)
RETURNS INTEGER AS $$
BEGIN
  RETURN CASE status
    WHEN 'draft' THEN 1
    WHEN 'in_progress' THEN 2
    WHEN 'completed' THEN 3
    WHEN 'archived' THEN 4
    WHEN 'cancelled' THEN 5
    WHEN 'on_hold' THEN 6
    ELSE 99
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create index for status-based sorting (optional, helps with performance)
-- Note: This is a functional index that can help with status_asc queries
CREATE INDEX IF NOT EXISTS idx_jobs_status_rank 
ON jobs(organization_id, (get_status_rank(status)), created_at DESC, id DESC)
WHERE archived_at IS NULL AND deleted_at IS NULL;

COMMENT ON FUNCTION get_status_rank IS 'Returns deterministic rank for job status. Used for stable sorting in cursor pagination.';

