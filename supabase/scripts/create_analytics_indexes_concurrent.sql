-- Create analytics indexes. Safe to run inside a transaction (e.g. Supabase SQL Editor or migration).
-- For zero-downtime on large tables, run each with CONCURRENTLY from psql in autocommit, e.g.:
--   psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_... ON ..."

-- 1/5
CREATE INDEX IF NOT EXISTS idx_mitigation_items_org_created
  ON mitigation_items(organization_id, created_at);

-- 2/5
CREATE INDEX IF NOT EXISTS idx_signatures_org_job
  ON signatures(organization_id, job_id);

CREATE INDEX IF NOT EXISTS idx_signatures_org_signed_at
  ON signatures(organization_id, signed_at DESC)
  INCLUDE (job_id);

-- 3/5
CREATE INDEX IF NOT EXISTS idx_documents_org_job_type
  ON documents(organization_id, job_id, type)
  WHERE job_id IS NOT NULL;

-- 5/5
CREATE INDEX IF NOT EXISTS idx_jobs_org_created
  ON jobs(organization_id, created_at)
  WHERE deleted_at IS NULL;
