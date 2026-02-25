-- Add completed_at to jobs for accurate completion metrics (analytics use this instead of updated_at).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
COMMENT ON COLUMN jobs.completed_at IS 'When the job was first marked completed; used for completion and on-time metrics.';

-- Backfill: completed jobs get completed_at = updated_at so existing metrics stay consistent until next status change.
UPDATE jobs
SET completed_at = updated_at
WHERE status = 'completed' AND completed_at IS NULL;
