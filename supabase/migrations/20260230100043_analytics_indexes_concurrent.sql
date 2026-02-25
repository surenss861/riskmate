-- Analytics indexes created CONCURRENTLY to avoid write locks on production.
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction. If this migration
-- fails with "cannot run inside a transaction block", apply this file manually
-- (e.g. Supabase SQL Editor or: psql -v ON_ERROR_STOP=1 -f this_file.sql) so
-- it runs outside a transaction.

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
