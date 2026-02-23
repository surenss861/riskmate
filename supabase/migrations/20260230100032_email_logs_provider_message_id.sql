-- Store provider (e.g. Resend) message id for correlating webhook bounce events with sent emails.
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS provider_message_id TEXT;

CREATE INDEX IF NOT EXISTS idx_email_logs_provider_message_id ON email_logs(provider_message_id) WHERE provider_message_id IS NOT NULL;

COMMENT ON COLUMN email_logs.provider_message_id IS 'Provider email id (e.g. Resend email_id) for webhook correlation.';
