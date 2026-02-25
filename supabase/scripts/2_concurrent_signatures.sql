CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signatures_org_job
  ON signatures(organization_id, job_id);
