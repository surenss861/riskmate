-- Use a JWT-based service_role check reliable under PostgREST/Supabase (request.jwt.claims.role).
-- session_user/current_user may not equal 'service_role' when the service-role key is used due to
-- authenticator/role switching; the JWT role claim is set correctly for service-role invocations.

CREATE OR REPLACE FUNCTION get_webhook_endpoint_stats(p_org_id uuid)
RETURNS TABLE (
  endpoint_id uuid,
  delivered bigint,
  pending bigint,
  failed bigint,
  last_delivery timestamptz,
  last_success_at timestamptz,
  last_terminal_failure_at timestamptz,
  last_failure_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH attempt_stats AS (
    SELECT
      wd.endpoint_id,
      max(wda.created_at) FILTER (WHERE wda.response_status IS NULL OR wda.response_status < 200 OR wda.response_status >= 300) AS last_failure_at,
      max(wda.created_at) AS last_attempt_at
    FROM webhook_delivery_attempts wda
    JOIN webhook_deliveries wd ON wd.id = wda.delivery_id
    JOIN webhook_endpoints we ON we.id = wd.endpoint_id
    WHERE we.organization_id = p_org_id
    GROUP BY wd.endpoint_id
  ),
  terminal_failure_times AS (
    SELECT
      wd.endpoint_id,
      max(wda.created_at) AS last_terminal_failure_at
    FROM webhook_deliveries wd
    JOIN webhook_delivery_attempts wda ON wda.delivery_id = wd.id
    JOIN webhook_endpoints we ON we.id = wd.endpoint_id
    WHERE we.organization_id = p_org_id
      AND wd.delivered_at IS NULL
      AND wd.next_retry_at IS NULL
      AND wd.processing_since IS NULL
      AND (wd.terminal_outcome IS NULL OR wd.terminal_outcome = 'failed')
    GROUP BY wd.endpoint_id
  )
  SELECT
    wd.endpoint_id,
    count(*) FILTER (WHERE wd.delivered_at IS NOT NULL)::bigint AS delivered,
    count(*) FILTER (WHERE wd.delivered_at IS NULL AND wd.next_retry_at IS NOT NULL)::bigint AS pending,
    count(*) FILTER (WHERE wd.delivered_at IS NULL AND wd.next_retry_at IS NULL AND wd.processing_since IS NULL AND (wd.terminal_outcome IS NULL OR wd.terminal_outcome = 'failed'))::bigint AS failed,
    NULLIF(GREATEST(
      COALESCE(ast.last_attempt_at, '1970-01-01'::timestamptz),
      COALESCE(max(wd.delivered_at), '1970-01-01'::timestamptz),
      COALESCE(max(wd.created_at), '1970-01-01'::timestamptz)
    ), '1970-01-01'::timestamptz) AS last_delivery,
    max(wd.delivered_at) FILTER (WHERE wd.delivered_at IS NOT NULL) AS last_success_at,
    max(tft.last_terminal_failure_at) AS last_terminal_failure_at,
    ast.last_failure_at
  FROM webhook_deliveries wd
  JOIN webhook_endpoints we ON we.id = wd.endpoint_id
  LEFT JOIN attempt_stats ast ON ast.endpoint_id = wd.endpoint_id
  LEFT JOIN terminal_failure_times tft ON tft.endpoint_id = wd.endpoint_id
  WHERE we.organization_id = p_org_id
    AND (
      (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json->>'role') = 'service_role'
      OR p_org_id IN (SELECT public.webhook_admin_org_ids())
    )
  GROUP BY wd.endpoint_id, ast.last_attempt_at, ast.last_failure_at;
$$;

COMMENT ON FUNCTION get_webhook_endpoint_stats(uuid) IS
  'Returns per-endpoint delivery counts and last delivery time for org. Excludes in-progress (processing_since set) from failed count. In-function tenant guard: JWT role = service_role (PostgREST) or p_org_id in webhook_admin_org_ids(). Only service_role may execute; API uses admin client.';
