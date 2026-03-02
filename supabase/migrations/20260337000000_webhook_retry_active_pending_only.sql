-- Redefine "active retry" for source-delivery idempotency: pending or in-progress only.
-- Terminal failed/cancelled retry rows (delivered_at IS NULL but terminal_outcome set) no longer
-- block further manual retries from the same source delivery.

DROP INDEX IF EXISTS idx_webhook_deliveries_one_active_retry_per_source;

-- At most one pending/in-progress retry per source delivery.
-- Active = (next_retry_at IS NOT NULL OR processing_since IS NOT NULL) AND terminal_outcome IS NULL.
CREATE UNIQUE INDEX idx_webhook_deliveries_one_active_retry_per_source
  ON webhook_deliveries(source_delivery_id)
  WHERE source_delivery_id IS NOT NULL
    AND (next_retry_at IS NOT NULL OR processing_since IS NOT NULL)
    AND terminal_outcome IS NULL;

-- Update retry creation to use the same active criteria in the EXISTS guard.
CREATE OR REPLACE FUNCTION create_webhook_delivery_retry(p_source_delivery_id uuid)
RETURNS TABLE(outcome text, retry_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_src RECORD;
  v_new_id uuid;
BEGIN
  -- Lock the source delivery row so eligibility and duplicate check are atomic with insert.
  SELECT id, endpoint_id, event_type, payload, delivered_at, terminal_outcome, attempt_count
  INTO v_src
  FROM webhook_deliveries
  WHERE id = p_source_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    outcome := 'not_found';
    retry_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Eligible: undelivered and (modern terminal failed, or legacy exhausted: terminal_outcome IS NULL with attempt_count >= 5).
  IF v_src.delivered_at IS NOT NULL THEN
    outcome := 'ineligible';
    retry_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  IF v_src.terminal_outcome IS NOT NULL AND v_src.terminal_outcome <> 'failed' THEN
    outcome := 'ineligible';
    retry_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;
  IF v_src.terminal_outcome IS NULL AND COALESCE(v_src.attempt_count, 0) < 5 THEN
    outcome := 'ineligible';
    retry_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Endpoint must be active so the retry is not immediately cancelled by the worker (atomic with insert).
  IF NOT (SELECT COALESCE(is_active, false) FROM webhook_endpoints WHERE id = v_src.endpoint_id) THEN
    outcome := 'endpoint_paused';
    retry_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check for existing active retry (pending or in-progress only; terminal retries do not block).
  IF EXISTS (
    SELECT 1 FROM webhook_deliveries
    WHERE source_delivery_id = p_source_delivery_id
      AND (next_retry_at IS NOT NULL OR processing_since IS NOT NULL)
      AND terminal_outcome IS NULL
  ) THEN
    outcome := 'already_scheduled';
    retry_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO webhook_deliveries (
    endpoint_id, event_type, payload, attempt_count, next_retry_at, source_delivery_id
  )
  VALUES (
    v_src.endpoint_id, v_src.event_type, v_src.payload, 1, now(), p_source_delivery_id
  )
  RETURNING id INTO v_new_id;

  outcome := 'created';
  retry_id := v_new_id;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION create_webhook_delivery_retry(uuid) IS
  'Atomically creates a manual retry for a terminally failed delivery. Locks source, verifies eligibility (delivered_at IS NULL; terminal_outcome = failed OR legacy: terminal_outcome IS NULL AND attempt_count >= 5), checks endpoint is_active (returns endpoint_paused if paused), ensures no existing active (pending/in-progress) retry for that source, inserts one row. Returns outcome: created | already_scheduled | ineligible | endpoint_paused | not_found. Service-role only.';
