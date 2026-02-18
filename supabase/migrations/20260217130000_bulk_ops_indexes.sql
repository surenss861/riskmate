-- Performance indexes for bulk ops: list/filter by org+status and org+assignee.
-- Run after assignment denormalization (20260217100000) so assigned_to_id exists.
CREATE INDEX IF NOT EXISTS idx_jobs_org_status
  ON jobs(organization_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_assigned
  ON jobs(organization_id, assigned_to_id)
  WHERE deleted_at IS NULL;
