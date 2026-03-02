-- Atomic claim of pending webhook deliveries for the worker (FOR UPDATE SKIP LOCKED).
-- Reduces N+1 round-trips to a single call. Service-role only.

CREATE OR REPLACE FUNCTION claim_pending_webhook_deliveries(p_limit int DEFAULT 50)
RETURNS SETOF webhook_deliveries
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH candidates AS (
    SELECT id
    FROM webhook_deliveries
    WHERE delivered_at IS NULL
      AND processing_since IS NULL
      AND next_retry_at IS NOT NULL
      AND next_retry_at <= now()
      AND attempt_count <= 5  -- must match MAX_ATTEMPTS in apps/backend/src/workers/webhookDelivery.ts
      AND terminal_outcome IS NULL
    ORDER BY attempt_count ASC, next_retry_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  ),
  claimed AS (
    UPDATE webhook_deliveries d
    SET processing_since = now()
    FROM candidates c
    WHERE d.id = c.id
    RETURNING d.*
  )
  SELECT * FROM claimed;
$$;

COMMENT ON FUNCTION claim_pending_webhook_deliveries(int) IS 'Claims up to p_limit pending delivery rows for the webhook worker; orders by attempt_count ASC then next_retry_at ASC to prioritize first attempts and readiness. Service-role only.';

REVOKE EXECUTE ON FUNCTION claim_pending_webhook_deliveries(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_pending_webhook_deliveries(int) FROM anon;
REVOKE EXECUTE ON FUNCTION claim_pending_webhook_deliveries(int) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_pending_webhook_deliveries(int) TO service_role;
