-- Completion-by-week MV: keyed by completion date (COALESCE(completed_at, created_at))
-- so completion trends bucket by when jobs were completed, not created.
-- date_trunc_week_monday is defined in 20260230100033_analytics_weekly_job_stats_mv.sql.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_matviews WHERE schemaname = 'public' AND matviewname = 'analytics_weekly_completion_stats') THEN
    CREATE MATERIALIZED VIEW analytics_weekly_completion_stats AS
    SELECT
      j.organization_id,
      date_trunc_week_monday(COALESCE(j.completed_at, j.created_at)) AS week_start,
      COUNT(*)::BIGINT AS jobs_completed
    FROM jobs j
    WHERE j.deleted_at IS NULL
      AND LOWER(COALESCE(j.status, '')) = 'completed'
      AND COALESCE(j.completed_at, j.created_at) >= (NOW() AT TIME ZONE 'UTC' - INTERVAL '2 years')
    GROUP BY j.organization_id, date_trunc_week_monday(COALESCE(j.completed_at, j.created_at));
    CREATE UNIQUE INDEX ON analytics_weekly_completion_stats (organization_id, week_start);
    COMMENT ON MATERIALIZED VIEW analytics_weekly_completion_stats IS 'Weekly completion counts keyed by completion date; refresh via refresh_analytics_weekly_job_stats().';
  END IF;
END $$;

-- Update refresh to include completion MV
CREATE OR REPLACE FUNCTION refresh_analytics_weekly_job_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_weekly_job_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY analytics_weekly_completion_stats;
EXCEPTION
  WHEN feature_not_supported THEN
    REFRESH MATERIALIZED VIEW analytics_weekly_job_stats;
    REFRESH MATERIALIZED VIEW analytics_weekly_completion_stats;
END;
$$;
