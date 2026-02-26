-- Safe to run inside a transaction (e.g. SQL Editor). For zero-downtime, run each
-- statement with CONCURRENTLY from psql in autocommit: psql "$DATABASE_URL" -c "CREATE INDEX CONCURRENTLY ..."
CREATE INDEX IF NOT EXISTS idx_signatures_org_job
  ON signatures(organization_id, job_id);

CREATE INDEX IF NOT EXISTS idx_signatures_org_signed_at
  ON signatures(organization_id, signed_at DESC)
  INCLUDE (job_id);
