-- Create analytics indexes with CONCURRENTLY (avoids write locks).
-- CREATE INDEX CONCURRENTLY cannot run inside a transaction block.
--
-- Option A - Supabase SQL Editor: run the 4 numbered files ONE AT A TIME
--   (in order: 1_concurrent_mitigation_items.sql, 2_concurrent_signatures.sql,
--    3_concurrent_documents.sql, 4_concurrent_jobs.sql).
--   If one file still errors with "cannot run inside a transaction block",
--   use Option B.
--
-- Option B - From terminal (autocommit, no transaction):
--   psql "$DATABASE_URL" -f supabase/scripts/1_concurrent_mitigation_items.sql
--   psql "$DATABASE_URL" -f supabase/scripts/2_concurrent_signatures.sql
--   psql "$DATABASE_URL" -f supabase/scripts/3_concurrent_documents.sql
--   psql "$DATABASE_URL" -f supabase/scripts/4_concurrent_jobs.sql
--
-- Option C - Copy-paste: run each statement below separately in SQL Editor.

-- 1/5
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mitigation_items_org_created
  ON mitigation_items(organization_id, created_at);

-- 2/5
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signatures_org_job
  ON signatures(organization_id, job_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_signatures_org_signed_at
  ON signatures(organization_id, signed_at DESC)
  INCLUDE (job_id);

-- 3/5
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_documents_org_job_type
  ON documents(organization_id, job_id, type)
  WHERE job_id IS NOT NULL;

-- 5/5
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_org_created
  ON jobs(organization_id, created_at)
  WHERE deleted_at IS NULL;
