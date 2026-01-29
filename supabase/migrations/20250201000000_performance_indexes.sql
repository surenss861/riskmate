-- Performance indexes for common query patterns (Week 5-6 caching pass).
-- All indexes use IF NOT EXISTS so the migration is safe to re-run.

-- Jobs (list, filters, dashboard)
CREATE INDEX IF NOT EXISTS idx_jobs_org_status
  ON jobs(organization_id, status);

CREATE INDEX IF NOT EXISTS idx_jobs_org_created
  ON jobs(organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_org_risk_level
  ON jobs(organization_id, risk_level)
  WHERE risk_level IS NOT NULL;

-- Mitigation items (job detail checklist)
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
