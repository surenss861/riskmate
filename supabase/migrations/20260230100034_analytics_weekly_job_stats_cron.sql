-- Schedule refresh of analytics_weekly_job_stats so weekly/time-bucketed analytics use up-to-date data.
-- refresh_analytics_weekly_job_stats() is defined in 20260230100033_analytics_weekly_job_stats_mv.sql.
--
-- Schedule hourly refresh via pg_cron (Supabase Pro / when pg_cron is enabled).
-- If pg_cron is not available, the block no-ops so the migration still succeeds; call
-- refresh_analytics_weekly_job_stats() from an external cron or after bulk job imports.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('refresh-analytics-weekly-job-stats');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- job may not exist yet
    END;
    PERFORM cron.schedule(
      'refresh-analytics-weekly-job-stats',
      '0 * * * *',
      'SELECT refresh_analytics_weekly_job_stats();'
    );
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    NULL; -- cron.schedule/cron.unschedule not available (e.g. schema not in path)
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule refresh_analytics_weekly_job_stats cron: %', SQLERRM;
END
$$;
