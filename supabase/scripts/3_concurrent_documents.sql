-- Safe to run inside a transaction (e.g. SQL Editor).
CREATE INDEX IF NOT EXISTS idx_documents_org_job_type
  ON documents(organization_id, job_id, type)
  WHERE job_id IS NOT NULL;
