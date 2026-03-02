-- Harden api_key_rate_limits: enable RLS and allow only service_role to read/write.
-- Prevents anon/authenticated from mutating bucket rows via Supabase APIs (quota bypass/reset or DoS).
-- increment_api_key_rate_limit remains executable only by service_role (see 20260342000000).

ALTER TABLE api_key_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS api_key_rate_limits_service ON api_key_rate_limits;
CREATE POLICY api_key_rate_limits_service ON api_key_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

COMMENT ON POLICY api_key_rate_limits_service ON api_key_rate_limits IS 'Only service_role can read/write rate limit buckets; anon and authenticated get no rows.';
