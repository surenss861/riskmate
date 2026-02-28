-- Webhook RLS: restrict authenticated access to owner/admin only.
-- Prevents non-admin org members from mutating/reading webhook data via Supabase REST.
-- Service role policies are unchanged for worker delivery.

-- Helper: org IDs where the current user is owner or admin (organization_members or legacy users.role).
CREATE OR REPLACE FUNCTION public.webhook_admin_org_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT organization_id FROM organization_members
  WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  UNION
  SELECT organization_id FROM users
  WHERE id = auth.uid() AND role IN ('owner', 'admin');
$$;

REVOKE EXECUTE ON FUNCTION public.webhook_admin_org_ids() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.webhook_admin_org_ids() TO authenticated;

-- webhook_endpoints: owner/admin only
DROP POLICY IF EXISTS webhook_endpoints_org ON webhook_endpoints;
CREATE POLICY webhook_endpoints_org ON webhook_endpoints
  FOR ALL
  USING (organization_id IN (SELECT public.webhook_admin_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.webhook_admin_org_ids()));

-- webhook_deliveries: owner/admin only (via endpoint org)
DROP POLICY IF EXISTS webhook_deliveries_via_endpoint ON webhook_deliveries;
CREATE POLICY webhook_deliveries_via_endpoint ON webhook_deliveries
  FOR ALL
  USING (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT public.webhook_admin_org_ids())
    )
  )
  WITH CHECK (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT public.webhook_admin_org_ids())
    )
  );

-- webhook_delivery_attempts: owner/admin only (via delivery -> endpoint -> org)
DROP POLICY IF EXISTS webhook_delivery_attempts_via_delivery ON webhook_delivery_attempts;
CREATE POLICY webhook_delivery_attempts_via_delivery ON webhook_delivery_attempts
  FOR ALL
  USING (
    delivery_id IN (
      SELECT wd.id FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      WHERE we.organization_id IN (SELECT public.webhook_admin_org_ids())
    )
  )
  WITH CHECK (
    delivery_id IN (
      SELECT wd.id FROM webhook_deliveries wd
      JOIN webhook_endpoints we ON we.id = wd.endpoint_id
      WHERE we.organization_id IN (SELECT public.webhook_admin_org_ids())
    )
  );

-- webhook_endpoint_alert_state: owner/admin only (via endpoint org)
DROP POLICY IF EXISTS webhook_endpoint_alert_state_via_endpoint ON webhook_endpoint_alert_state;
CREATE POLICY webhook_endpoint_alert_state_via_endpoint ON webhook_endpoint_alert_state
  FOR ALL
  USING (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT public.webhook_admin_org_ids())
    )
  )
  WITH CHECK (
    endpoint_id IN (
      SELECT id FROM webhook_endpoints
      WHERE organization_id IN (SELECT public.webhook_admin_org_ids())
    )
  );
