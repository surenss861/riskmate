-- Durable email queue: jobs survive restarts; workers claim with lease/visibility timeout to avoid duplicate processing.

CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  recipient TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  attempts INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  lease_holder TEXT,
  lease_expires_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_email_queue_claim
  ON email_queue (scheduled_at, created_at);

CREATE INDEX IF NOT EXISTS idx_email_queue_lease_expires
  ON email_queue (lease_expires_at)
  WHERE lease_holder IS NOT NULL;

COMMENT ON TABLE email_queue IS 'Durable queue for outbound emails; workers claim rows with a lease to avoid duplicate processing across instances.';

-- Atomically claim up to p_max jobs: set lease_holder and lease_expires_at, return claimed rows.
CREATE OR REPLACE FUNCTION claim_email_queue_jobs(
  p_holder_id    text,
  p_visibility_sec int,
  p_max          int DEFAULT 10
)
RETURNS SETOF email_queue
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE email_queue AS q
  SET lease_holder = p_holder_id,
      lease_expires_at = now() + (p_visibility_sec || ' seconds')::interval
  FROM (
    SELECT eq.id
    FROM email_queue eq
    WHERE (eq.lease_expires_at IS NULL OR eq.lease_expires_at < now())
      AND eq.scheduled_at <= now()
    ORDER BY eq.scheduled_at, eq.created_at
    LIMIT p_max
  ) AS sub
  WHERE q.id = sub.id
  RETURNING q.*;
END;
$$;

COMMENT ON FUNCTION claim_email_queue_jobs(text, int, int) IS 'Claim pending email queue jobs with a visibility timeout; returns claimed rows for processing.';
