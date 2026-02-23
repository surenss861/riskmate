-- RLS and privilege hardening for email_queue and email_logs.
-- Only the backend (service role) may read/write these tables and call claim_email_queue_jobs.
-- Client keys (anon, authenticated) must not access queue/log tables or the claim RPC.

-- Enable RLS on both tables
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policies: allow full access only for service role (backend worker)
CREATE POLICY "Service role full access email_queue"
  ON email_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access email_logs"
  ON email_logs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Revoke default access from anon and authenticated so client keys cannot select/upsert
REVOKE ALL ON email_queue FROM anon, authenticated;
REVOKE ALL ON email_logs FROM anon, authenticated;

-- Explicit grant for service role (backend uses SUPABASE_SERVICE_ROLE_KEY)
GRANT ALL ON email_queue TO service_role;
GRANT ALL ON email_logs TO service_role;

-- Restrict claim_email_queue_jobs to service role only (not callable via client keys)
REVOKE EXECUTE ON FUNCTION claim_email_queue_jobs(text, int, int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION claim_email_queue_jobs(text, int, int) TO service_role;
