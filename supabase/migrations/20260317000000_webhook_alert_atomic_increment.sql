-- Atomic increment of consecutive_failures for webhook endpoint alert state.
-- Used by the delivery worker so concurrent terminal failures for the same endpoint
-- do not undercount; alerting is decided from the returned value.

CREATE OR REPLACE FUNCTION public.increment_webhook_endpoint_consecutive_failures(p_endpoint_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
  DECLARE
    v_new_count integer;
  BEGIN
    INSERT INTO webhook_endpoint_alert_state (endpoint_id, consecutive_failures, updated_at)
    VALUES (p_endpoint_id, 1, now())
    ON CONFLICT (endpoint_id) DO UPDATE
    SET
      consecutive_failures = webhook_endpoint_alert_state.consecutive_failures + 1,
      updated_at = now()
    RETURNING consecutive_failures INTO v_new_count;
    RETURN v_new_count;
  END;
$$;

COMMENT ON FUNCTION public.increment_webhook_endpoint_consecutive_failures(uuid) IS
  'Atomically increments consecutive_failures for the endpoint and returns the new value. Used by webhook delivery worker under concurrency.';

REVOKE EXECUTE ON FUNCTION public.increment_webhook_endpoint_consecutive_failures(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_webhook_endpoint_consecutive_failures(uuid) TO service_role;
