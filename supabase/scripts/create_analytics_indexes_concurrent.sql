-- Analytics indexes (safe to run in SQL Editor or migrations).
-- Same as migration 20260230100043; use this if you need to create indexes manually.
-- (CONCURRENTLY is not used here so it runs inside a transaction; run each CONCURRENTLY statement separately if you need zero write-lock.)
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
