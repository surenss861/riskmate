-- Store queue job UUID separately; job_id is reserved for domain identifier (task/job/report id).
ALTER TABLE email_logs ADD COLUMN IF NOT EXISTS queue_id TEXT;

COMMENT ON COLUMN email_logs.job_id IS 'Domain identifier (e.g. task id, job id, report run id) from the email context.';
COMMENT ON COLUMN email_logs.queue_id IS 'Email queue job UUID for correlation with queue processing.';
