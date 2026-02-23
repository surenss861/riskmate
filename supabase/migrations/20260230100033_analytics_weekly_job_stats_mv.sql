-- Materialized view for weekly job stats (analytics / job-completion performance).
-- Refreshed via refresh_analytics_weekly_job_stats() — call from cron or after bulk updates.
-- Index on jobs(organization_id, created_at) already exists (idx_jobs_org_created).

-- Week start (Monday) in UTC for a given timestamp (ISO week)
CREATE OR REPLACE FUNCTION date_trunc_week_monday(ts TIMESTAMPTZ)
RETURNS DATE AS $$
  SELECT (DATE_TRUNC('week', ts AT TIME ZONE 'UTC'))::DATE;
$$ LANGUAGE SQL IMMUTABLE;

-- Materialized view: one row per (organization_id, week_start)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'analytics_weekly_job_stats') THEN
    CREATE MATERIALIZED VIEW analytics_weekly_job_stats AS
    SELECT
      j.organization_id,
      date_trunc_week_monday(j.created_at) AS week_start,
      COUNT(*) AS jobs_created,
      COUNT(*) FILTER (WHERE LOWER(COALESCE(j.status, '')) = 'completed') AS jobs_completed,
      ROUND(AVG(j.risk_score) FILTER (WHERE j.risk_score IS NOT NULL)::NUMERIC, 2) AS avg_risk,
      COUNT(*) FILTER (WHERE (j.risk_score IS NOT NULL AND j.risk_score >= 70)) AS high_risk_count
    FROM jobs j
    WHERE j.deleted_at IS NULL
      AND j.created_at >= (NOW() AT TIME ZONE 'UTC' - INTERVAL '2 years')
    GROUP BY j.organization_id, date_trunc_week_monday(j.created_at);
    CREATE UNIQUE INDEX ON analytics_weekly_job_stats (organization_id, week_start);
    COMMENT ON MATERIALIZED VIEW analytics_weekly_job_stats IS 'Weekly aggregates for analytics; refresh via refresh_analytics_weekly_job_stats().';
  END IF;
END $$;

-- Refresh function (call from cron or app)
CREATE OR REPLACE FUNCTION refresh_analytics_weekly_job_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_weekly_job_stats;
EXCEPTION
  WHEN feature_not_supported THEN
    REFRESH MATERIALIZED VIEW analytics_weekly_job_stats;
END;
$$;

COMMENT ON FUNCTION refresh_analytics_weekly_job_stats() IS 'Refreshes analytics_weekly_job_stats MV. Call periodically (e.g. hourly) or after bulk job imports.';

-- Ensure index exists for analytics by (organization_id, created_at) — already in performance_indexes; add if missing for created_at ASC for range scans
CREATE INDEX IF NOT EXISTS idx_jobs_org_created_at_asc
  ON jobs(organization_id, created_at)
  WHERE deleted_at IS NULL;
