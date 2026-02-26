CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signatures_org_job
  ON signatures(organization_id, job_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signatures_org_signed_at
  ON signatures(organization_id, signed_at DESC)
  INCLUDE (job_id);
