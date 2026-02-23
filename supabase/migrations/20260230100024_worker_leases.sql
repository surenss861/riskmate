-- Distributed worker coordination: only one instance runs each scheduled worker cycle.
-- Used by: weekly digest, deadline reminders, task reminders (and optionally email queue processor).

CREATE TABLE IF NOT EXISTS worker_leases (
  lease_key   text PRIMARY KEY,
  holder_id   text NOT NULL,
  expires_at  timestamptz NOT NULL
);

COMMENT ON TABLE worker_leases IS 'Short-lived leases so a single instance runs each scheduled worker cycle in multi-instance deployments.';

-- Try to acquire or renew a lease. Returns true if this holder has the lease (acquired or renewed).
-- p_ttl_sec: lease duration in seconds (should cover one cycle, e.g. 300).
CREATE OR REPLACE FUNCTION try_acquire_worker_lease(
  p_key      text,
  p_holder   text,
  p_ttl_sec  int
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_holder text;
BEGIN
  -- Release expired lease for this key
  DELETE FROM worker_leases
  WHERE lease_key = p_key AND expires_at < now();

  INSERT INTO worker_leases (lease_key, holder_id, expires_at)
  VALUES (p_key, p_holder, now() + (p_ttl_sec || ' seconds')::interval)
  ON CONFLICT (lease_key) DO UPDATE
  SET holder_id = p_holder, expires_at = now() + (p_ttl_sec || ' seconds')::interval
  WHERE worker_leases.expires_at < now() OR worker_leases.holder_id = p_holder
  RETURNING holder_id INTO v_holder;

  RETURN v_holder = p_holder;
END;
$$;

COMMENT ON FUNCTION try_acquire_worker_lease(text, text, int) IS 'Acquire or renew a worker lease; returns true if this holder has the lease.';