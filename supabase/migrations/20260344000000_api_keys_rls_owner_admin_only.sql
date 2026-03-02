-- api_keys RLS: restrict authenticated access to owner/admin only.
-- Replaces api_keys_org (any org member) so non-admin members cannot create/update/revoke keys via Supabase data APIs.
-- Aligns DB policy with app/api/api-keys route-layer requireOwnerOrAdmin. service_role policy unchanged.

DROP POLICY IF EXISTS api_keys_org ON api_keys;
CREATE POLICY api_keys_org ON api_keys
  FOR ALL
  USING (organization_id IN (SELECT public.webhook_admin_org_ids()))
  WITH CHECK (organization_id IN (SELECT public.webhook_admin_org_ids()));

COMMENT ON POLICY api_keys_org ON api_keys IS 'Only org owner/admin can read/write API keys; matches requireOwnerOrAdmin in API routes.';
