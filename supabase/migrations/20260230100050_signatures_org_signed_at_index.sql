-- Composite index for compliance RPCs that filter signatures by organization_id and signed_at.
-- Enables index use for get_compliance_rate_kpis and get_trends_compliance_buckets (and get_trends_day_buckets compliance).
-- job_id INCLUDE allows index-only scans when only job_id is selected.
CREATE INDEX IF NOT EXISTS idx_signatures_org_signed_at
  ON signatures(organization_id, signed_at DESC)
  INCLUDE (job_id);
