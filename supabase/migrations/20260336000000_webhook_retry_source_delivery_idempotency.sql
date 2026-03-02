-- Source-delivery-scoped idempotency for manual retries: one active retry per source delivery,
-- enforced at the database so concurrent retry requests cannot create duplicate retry rows.

ALTER TABLE webhook_deliveries
  ADD COLUMN IF NOT EXISTS source_delivery_id UUID REFERENCES webhook_deliveries(id) ON DELETE SET NULL;

COMMENT ON COLUMN webhook_deliveries.source_delivery_id IS
  'When set, this row is a manual retry of the referenced delivery; at most one active (undelivered) retry per source.';

-- At most one undelivered retry per source delivery (idempotency for manual retry).
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_deliveries_one_active_retry_per_source
  ON webhook_deliveries(source_delivery_id)
  WHERE source_delivery_id IS NOT NULL AND delivered_at IS NULL;

-- Atomic retry creation: lock source, verify eligibility, ensure no existing active retry for this source, insert one row.
-- Returns outcome and retry_id so the API can return ALREADY_SCHEDULED only when this source already has an active retry.
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
  SELECT id, endpoint_id, event_type, payload, delivered_at, terminal_outcome
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

  IF v_src.delivered_at IS NOT NULL OR v_src.terminal_outcome IS DISTINCT FROM 'failed' THEN
    outcome := 'ineligible';
    retry_id := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Check for existing active retry tied to this same source (enforces idempotency).
  IF EXISTS (
    SELECT 1 FROM webhook_deliveries
    WHERE source_delivery_id = p_source_delivery_id AND delivered_at IS NULL
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
  'Atomically creates a manual retry for a terminally failed delivery. Locks source, verifies eligibility (delivered_at IS NULL, terminal_outcome = failed), ensures no existing active retry for that source, inserts one row. Returns outcome: created | already_scheduled | ineligible | not_found. Service-role only.';

REVOKE EXECUTE ON FUNCTION create_webhook_delivery_retry(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_webhook_delivery_retry(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION create_webhook_delivery_retry(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_webhook_delivery_retry(uuid) TO service_role;
