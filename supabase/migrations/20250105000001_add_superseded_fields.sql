-- Add superseded chain fields to report_runs for audit trail

ALTER TABLE report_runs
  ADD COLUMN IF NOT EXISTS superseded_by_run_id UUID REFERENCES report_runs(id),
  ADD COLUMN IF NOT EXISTS superseded_reason TEXT,
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

-- Add index for querying superseded runs
CREATE INDEX IF NOT EXISTS idx_report_runs_superseded_by 
  ON report_runs(superseded_by_run_id) 
  WHERE superseded_by_run_id IS NOT NULL;

