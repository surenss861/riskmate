-- Safe to run inside a transaction (e.g. SQL Editor).
CREATE INDEX IF NOT EXISTS idx_jobs_org_created
  ON jobs(organization_id, created_at)
  WHERE deleted_at IS NULL;
