-- Idempotency Keys Cleanup Job
-- Deletes expired idempotency keys (older than 24 hours)
-- Run this daily via cron or scheduled function

-- Option 1: Manual cleanup (run via cron or scheduled job)
-- DELETE FROM idempotency_keys WHERE expires_at < NOW();

-- Option 2: Create a function that can be called by pg_cron or scheduled jobs
CREATE OR REPLACE FUNCTION cleanup_expired_idempotency_keys()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM idempotency_keys WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_idempotency_keys() IS 'Deletes idempotency keys that have expired (older than expires_at). Returns count of deleted rows.';

-- Optional: Create index to speed up cleanup queries (if not already indexed)
-- The expires_at index was already created in the main migration, but ensure it exists
CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expires_at ON idempotency_keys(expires_at);

-- To schedule via pg_cron (if installed):
-- SELECT cron.schedule('cleanup-idempotency-keys', '0 2 * * *', 'SELECT cleanup_expired_idempotency_keys();');
-- This runs daily at 2 AM UTC

