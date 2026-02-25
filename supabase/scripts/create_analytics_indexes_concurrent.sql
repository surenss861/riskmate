-- Create analytics indexes with CONCURRENTLY to avoid write locks.
-- Must be run OUTSIDE a transaction (e.g. SQL Editor, or pre-deploy script).
-- Each statement commits independently; safe to run manually or as a pre-deploy step.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mitigation_items_org_created
  ON mitigation_items(organization_id, created_at);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signatures_org_job
  ON signatures(organization_id, job_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_org_job_type
  ON documents(organization_id, job_id, type)
  WHERE job_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_org_created
  ON jobs(organization_id, created_at)
  WHERE deleted_at IS NULL;
