-- Webhook RLS: allow access by users.organization_id OR organization_members.organization_id
-- so org members resolved via organization_members (multi-org flows) can list/manage webhooks
-- and view delivery logs. Consistent with get_webhook_endpoint_stats tenant check.

-- Helper: org IDs the current user belongs to (users or organization_members)
CREATE OR REPLACE FUNCTION public.webhook_user_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM users WHERE id = auth.uid()
  UNION
  SELECT organization_id FROM organization_members WHERE user_id = auth.uid();
$$;

REVOKE EXECUTE ON FUNCTION public.webhook_user_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_user_org_ids() TO authenticated;

-- webhook_endpoints
DROP POLICY IF EXISTS webhook_endpoints_org ON webhook_endpoints;
CREATE POLICY webhook_endpoints_org ON webhook_endpoints
  FOR ALL
  USING (organization_id IN (SELECT public.webhook_user_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.webhook_user_org_ids()));

-- webhook_deliveries (via endpoint org)
DROP POLICY IF EXISTS webhook_deliveries_via_endpoint ON webhook_deliveries;
CREATE POLICY webhook_deliveries_via_endpoint ON webhook_deliveries
  FOR ALL
  USING (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT public.webhook_user_org_ids())
    )
  )
  WITH CHECK (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT public.webhook_user_org_ids())
    )
  );

-- webhook_delivery_attempts (via delivery -> endpoint -> org)
DROP POLICY IF EXISTS webhook_delivery_attempts_via_delivery ON webhook_delivery_attempts;
CREATE POLICY webhook_delivery_attempts_via_delivery ON webhook_delivery_attempts
  FOR ALL
  USING (
    delivery_id IN (
      SELECT wd.id FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      WHERE we.organization_id IN (SELECT public.webhook_user_org_ids())
    )
  )
  WITH CHECK (
    delivery_id IN (
      SELECT wd.id FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      WHERE we.organization_id IN (SELECT public.webhook_user_org_ids())
    )
  );

-- webhook_endpoint_alert_state (via endpoint org)
DROP POLICY IF EXISTS webhook_endpoint_alert_state_via_endpoint ON webhook_endpoint_alert_state;
CREATE POLICY webhook_endpoint_alert_state_via_endpoint ON webhook_endpoint_alert_state
  FOR ALL
  USING (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT public.webhook_user_org_ids())
    )
  )
  WITH CHECK (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT public.webhook_user_org_ids())
    )
  );
