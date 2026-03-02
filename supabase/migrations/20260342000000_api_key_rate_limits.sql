-- Shared storage for API key rate limiting so all instances share the same per-key window state.
-- Replaces in-memory store to enforce 1000 requests/hour per key across replicas and restarts.

CREATE TABLE IF NOT EXISTS api_key_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  count INT NOT NULL DEFAULT 0,
  reset_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_key_rate_limits_reset_at ON api_key_rate_limits(reset_at);

COMMENT ON TABLE api_key_rate_limits IS 'Per-API-key rate limit buckets; bucket_key format: apikey:<api_key_id>. All instances read/write this for global limit.';

-- Atomic increment and check. Returns allowed, current count, remaining, reset_at (epoch seconds), retry_after (seconds).
CREATE OR REPLACE FUNCTION increment_api_key_rate_limit(
  p_bucket_key TEXT,
  p_window_ms BIGINT,
  p_max_requests INT
)
RETURNS TABLE (
  allowed BOOLEAN,
  "count" INT,
  remaining INT,
  reset_at_epoch BIGINT,
  retry_after_seconds INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_count INT;
  v_reset_at TIMESTAMPTZ;
  v_now TIMESTAMPTZ := now();
  v_window_interval INTERVAL := (p_window_ms || ' ms')::INTERVAL;
BEGIN
  INSERT INTO api_key_rate_limits (bucket_key, count, reset_at)
  VALUES (p_bucket_key, 1, v_now + v_window_interval)
  ON CONFLICT (bucket_key) DO UPDATE SET
    count = CASE
      WHEN api_key_rate_limits.reset_at < v_now THEN 1
      ELSE api_key_rate_limits.count + 1
    END,
    reset_at = CASE
      WHEN api_key_rate_limits.reset_at < v_now THEN v_now + v_window_interval
      ELSE api_key_rate_limits.reset_at
    END
  RETURNING api_key_rate_limits.count, api_key_rate_limits.reset_at INTO v_count, v_reset_at;

  RETURN QUERY SELECT
    (v_count <= p_max_requests),
    v_count,
    GREATEST(0, p_max_requests - v_count),
    EXTRACT(EPOCH FROM v_reset_at)::BIGINT,
    GREATEST(0, CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_now))))::INT;
END;
$$;

COMMENT ON FUNCTION increment_api_key_rate_limit IS 'Atomic per-key rate limit check; use bucket_key = apikey:<api_key_id>. Keeps X-RateLimit-* and Retry-After contract.';

REVOKE EXECUTE ON FUNCTION increment_api_key_rate_limit(TEXT, BIGINT, INT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION increment_api_key_rate_limit(TEXT, BIGINT, INT) FROM anon;
REVOKE EXECUTE ON FUNCTION increment_api_key_rate_limit(TEXT, BIGINT, INT) FROM authenticated;
GRANT EXECUTE ON FUNCTION increment_api_key_rate_limit(TEXT, BIGINT, INT) TO service_role;
