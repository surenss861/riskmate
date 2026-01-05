-- Add 'complete' and 'superseded' statuses to report_runs
-- Also add optional completion metadata columns

ALTER TABLE report_runs 
  DROP CONSTRAINT IF EXISTS report_runs_status_check;

ALTER TABLE report_runs 
  ADD CONSTRAINT report_runs_status_check 
  CHECK (status IN ('draft', 'ready_for_signatures', 'complete', 'final', 'superseded'));

-- Add completion metadata columns (optional)
ALTER TABLE report_runs
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_hash TEXT;

-- Add index for status filtering
CREATE INDEX IF NOT EXISTS idx_report_runs_status_complete 
  ON report_runs(status) 
  WHERE status IN ('complete', 'final');

