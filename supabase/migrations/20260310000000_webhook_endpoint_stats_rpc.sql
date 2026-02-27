-- Aggregate webhook delivery stats per endpoint for dashboard (full history, not paginated).
-- Used by GET /api/webhooks/stats to show accurate delivered/pending/failed counts and last delivery.

CREATE OR REPLACE FUNCTION get_webhook_endpoint_stats(p_org_id uuid)
RETURNS TABLE (
  endpoint_id uuid,
  delivered bigint,
  pending bigint,
  failed bigint,
  last_delivery timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    wd.endpoint_id,
    count(*) FILTER (WHERE wd.delivered_at IS NOT NULL)::bigint AS delivered,
    count(*) FILTER (WHERE wd.delivered_at IS NULL AND wd.next_retry_at IS NOT NULL)::bigint AS pending,
    count(*) FILTER (WHERE wd.delivered_at IS NULL AND wd.next_retry_at IS NULL AND wd.attempt_count >= 1)::bigint AS failed,
    max(wd.created_at) AS last_delivery
  FROM webhook_deliveries wd
  JOIN webhook_endpoints we ON we.id = wd.endpoint_id
  WHERE we.organization_id = p_org_id
  GROUP BY wd.endpoint_id;
$$;

COMMENT ON FUNCTION get_webhook_endpoint_stats(uuid) IS 'Returns per-endpoint delivery counts and last delivery time for org; used by webhooks dashboard.';
