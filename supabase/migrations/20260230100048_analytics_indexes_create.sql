-- Create required analytics indexes in the managed migration flow.
-- These indexes are created non-concurrently so they run inside the migration transaction
-- and are reliably applied in all environments (Supabase, CI, local).
-- Same definitions as create_analytics_indexes_concurrent.sql but without CONCURRENTLY.

CREATE INDEX IF NOT EXISTS idx_mitigation_items_org_created
  ON mitigation_items(organization_id, created_at);

CREATE INDEX IF NOT EXISTS idx_signatures_org_job
  ON signatures(organization_id, job_id);

CREATE INDEX IF NOT EXISTS idx_documents_org_job_type
  ON documents(organization_id, job_id, type)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_created
  ON jobs(organization_id, created_at)
  WHERE deleted_at IS NULL;
