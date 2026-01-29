-- Performance indexes for common query patterns (Week 5-6 caching pass).
-- Jobs list query: WHERE organization_id = ? AND deleted_at IS NULL [AND status = ?] ORDER BY created_at DESC
-- So indexes include created_at and use partial WHERE deleted_at IS NULL.

-- Jobs: drop old indexes that don't match sort, then create optimal ones
DROP INDEX IF EXISTS idx_jobs_org_status;
DROP INDEX IF EXISTS idx_jobs_org_created;

CREATE INDEX IF NOT EXISTS idx_jobs_org_status_created
  ON jobs(organization_id, status, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_created
  ON jobs(organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_org_risk_level
  ON jobs(organization_id, risk_level)
  WHERE risk_level IS NOT NULL AND deleted_at IS NULL;

-- Mitigation items (job detail checklist). Table has no deleted_at; index by job_id and completion.
CREATE INDEX IF NOT EXISTS idx_mitigation_items_job
  ON mitigation_items(job_id);

CREATE INDEX IF NOT EXISTS idx_mitigation_items_completion
  ON mitigation_items(job_id, is_completed);

-- Documents (evidence by job)
CREATE INDEX IF NOT EXISTS idx_documents_job_created
  ON documents(job_id, created_at DESC)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_documents_org_job
  ON documents(organization_id, job_id)
  WHERE job_id IS NOT NULL;

-- Evidence table (if present: work_record_id = job id)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'evidence') THEN
    CREATE INDEX IF NOT EXISTS idx_evidence_work_record_created
      ON evidence(work_record_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_evidence_org_work_record
      ON evidence(organization_id, work_record_id);
  END IF;
END $$;

-- Exports (export sheet + history by job)
CREATE INDEX IF NOT EXISTS idx_exports_work_record_state_created
  ON exports(work_record_id, state, created_at DESC)
  WHERE work_record_id IS NOT NULL;

-- Audit (feed queries)
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created
  ON audit_logs(organization_id, created_at DESC);

-- Users / team (account page)
CREATE INDEX IF NOT EXISTS idx_users_org
  ON users(organization_id);
