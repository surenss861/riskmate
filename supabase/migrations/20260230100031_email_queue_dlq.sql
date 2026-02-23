-- Dead-letter queue for email jobs that failed permanently (e.g. after 3 attempts).
-- Enables audit and remediation without silent loss of notifications.

CREATE TABLE IF NOT EXISTS email_queue_dlq (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_queue_id UUID NOT NULL,
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  failed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_dlq_failed_at
  ON email_queue_dlq (failed_at);

CREATE INDEX IF NOT EXISTS idx_email_queue_dlq_type
  ON email_queue_dlq (type);

COMMENT ON TABLE email_queue_dlq IS 'Dead-letter queue for email jobs that permanently failed; enables alerting and remediation.';

-- RLS and privilege hardening: only backend (service role) may access DLQ; client roles must not see failed payloads.
ALTER TABLE email_queue_dlq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access email_queue_dlq" ON email_queue_dlq;
CREATE POLICY "Service role full access email_queue_dlq"
  ON email_queue_dlq
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON email_queue_dlq FROM anon, authenticated;
GRANT ALL ON email_queue_dlq TO service_role;
