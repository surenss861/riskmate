-- Prune expired api_key_rate_limits buckets to prevent unbounded table/index growth.
-- increment_api_key_rate_limit resets counters when windows expire but never deletes rows;
-- this cleanup removes stale buckets so the hot-path table stays small.
--
-- Operational expectation: run cleanup hourly. When pg_cron is available it is scheduled
-- at the top of every hour. If pg_cron is not available, call
-- cleanup_expired_api_key_rate_limits() from an external cron or scheduler.
--
-- Observability (production):
--   - List cron job: SELECT jobid, jobname, schedule FROM cron.job WHERE jobname = 'cleanup-api-key-rate-limits';
--   - Bucket count: SELECT count(*) FROM api_key_rate_limits;
--   - After cleanup, run again and compare; or log the function return value (deleted count).

CREATE OR REPLACE FUNCTION cleanup_expired_api_key_rate_limits()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete buckets whose rate-limit window ended at least 1 hour ago (window is 1h; safe grace).
  DELETE FROM api_key_rate_limits
  WHERE reset_at < now() - interval '1 hour';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION cleanup_expired_api_key_rate_limits() IS
  'Deletes api_key_rate_limits rows where reset_at is more than 1 hour in the past. Returns deleted count. Run hourly via pg_cron or external scheduler to prevent unbounded table growth.';

REVOKE EXECUTE ON FUNCTION cleanup_expired_api_key_rate_limits() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION cleanup_expired_api_key_rate_limits() FROM anon;
REVOKE EXECUTE ON FUNCTION cleanup_expired_api_key_rate_limits() FROM authenticated;
GRANT EXECUTE ON FUNCTION cleanup_expired_api_key_rate_limits() TO service_role;

-- Schedule hourly cleanup when pg_cron is available (Supabase Pro / when pg_cron is enabled).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('cleanup-api-key-rate-limits');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    PERFORM cron.schedule(
      'cleanup-api-key-rate-limits',
      '0 * * * *',
      'SELECT cleanup_expired_api_key_rate_limits();'
    );
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    NULL;
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not schedule cleanup-api-key-rate-limits cron: %', SQLERRM;
END
$$;
