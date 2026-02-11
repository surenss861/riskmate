-- ============================================================================
-- REPORT RUNS: packet_type, expanded status, and RLS for signature APIs
-- ============================================================================
-- Ensures report_runs supports packet_type (with index/default), status values
-- used by signature APIs (draft, ready_for_signatures, complete, final, superseded),
-- and RLS policies that allow INSERT with any allowed status and UPDATE transitions
-- to ready_for_signatures and complete.

-- 1) Ensure packet_type column exists with default and index (20251202 may already have added it)
ALTER TABLE report_runs
ADD COLUMN IF NOT EXISTS packet_type TEXT DEFAULT 'insurance';

-- Ensure packet_type constraint exists (idempotent: 20251202 adds inline check; we ensure named constraint if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'report_runs'::regclass
    AND conname = 'report_runs_packet_type_check'
  ) THEN
    ALTER TABLE report_runs
    ADD CONSTRAINT report_runs_packet_type_check
    CHECK (packet_type IN ('insurance', 'audit', 'incident', 'client_compliance'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_runs_packet_type ON report_runs(packet_type);
CREATE INDEX IF NOT EXISTS idx_report_runs_job_packet ON report_runs(job_id, packet_type);

-- 2) Expand status check constraint to all values used by signature APIs
ALTER TABLE report_runs DROP CONSTRAINT IF EXISTS report_runs_status_check;
ALTER TABLE report_runs
ADD CONSTRAINT report_runs_status_check
CHECK (status IN ('draft', 'ready_for_signatures', 'complete', 'final', 'superseded'));

-- 3) Backfill existing rows
UPDATE report_runs
SET packet_type = 'insurance'
WHERE packet_type IS NULL;

-- 4) RLS: Allow INSERT with any allowed status (not just draft)
DROP POLICY IF EXISTS "Organization members can create draft report runs" ON report_runs;
CREATE POLICY "Organization members can create report runs"
ON report_runs
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT organization_id FROM users WHERE id = auth.uid()
  )
  AND generated_by = auth.uid()
  AND status IN ('draft', 'ready_for_signatures', 'complete', 'final', 'superseded')
);

-- UPDATE policy already permits creator/admin to update; no status restriction,
-- so transitions to ready_for_signatures and complete are allowed.
-- (Policy "Creator or admin can update report runs" remains unchanged.)

COMMENT ON COLUMN report_runs.packet_type IS 'Type of report packet: insurance, audit, incident, or client_compliance';
