-- Aggregate webhook delivery stats per endpoint for dashboard (full history, not paginated).
-- Used by GET /api/webhooks/stats to show accurate delivered/pending/failed counts and last delivery.
-- Tenant scoping: returns data only if p_org_id is an organization the caller belongs to (users or organization_members).

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
    NULLIF(GREATEST(
      COALESCE(
        (SELECT max(wda.created_at)
         FROM webhook_delivery_attempts wda
         JOIN webhook_deliveries wd2 ON wd2.id = wda.delivery_id
         WHERE wd2.endpoint_id = wd.endpoint_id),
        '1970-01-01'::timestamptz
      ),
      COALESCE(max(wd.delivered_at), '1970-01-01'::timestamptz),
      COALESCE(max(wd.created_at), '1970-01-01'::timestamptz)
    ), '1970-01-01'::timestamptz) AS last_delivery
  FROM webhook_deliveries wd
  JOIN webhook_endpoints we ON we.id = wd.endpoint_id
  WHERE we.organization_id = p_org_id
    AND p_org_id IN (
      SELECT organization_id FROM users WHERE id = auth.uid()
      UNION
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  GROUP BY wd.endpoint_id;
$$;

COMMENT ON FUNCTION get_webhook_endpoint_stats(uuid) IS 'Returns per-endpoint delivery counts and last delivery time for org; used by webhooks dashboard. Caller must belong to p_org_id (users or organization_members).';

-- Privilege hardening: revoke broad execute, grant only to intended roles
REVOKE EXECUTE ON FUNCTION get_webhook_endpoint_stats(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_webhook_endpoint_stats(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION get_webhook_endpoint_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_webhook_endpoint_stats(uuid) TO service_role;
