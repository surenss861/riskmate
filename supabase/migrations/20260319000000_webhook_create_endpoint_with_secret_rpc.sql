-- Atomic webhook endpoint creation: insert endpoint and secret in one transaction so
-- secret insert failures do not leave active endpoints that can never deliver.

CREATE OR REPLACE FUNCTION create_webhook_endpoint_with_secret(
  p_organization_id uuid,
  p_url text,
  p_events text[],
  p_description text,
  p_created_by uuid,
  p_secret text
)
RETURNS TABLE (
  id uuid,
  url text,
  events text[],
  is_active boolean,
  description text,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO webhook_endpoints (organization_id, url, events, is_active, description, created_by)
  VALUES (p_organization_id, p_url, p_events, true, NULLIF(trim(p_description), ''), p_created_by)
  RETURNING webhook_endpoints.id INTO v_id;

  INSERT INTO webhook_endpoint_secrets (endpoint_id, secret)
  VALUES (v_id, p_secret);

  RETURN QUERY
  SELECT we.id, we.url, we.events, we.is_active, we.description, we.created_at
  FROM webhook_endpoints we
  WHERE we.id = v_id;
END;
$$;

COMMENT ON FUNCTION create_webhook_endpoint_with_secret(uuid, text, text[], text, uuid, text) IS
  'Atomically creates a webhook endpoint and its signing secret. Caller must have already verified admin/owner for p_organization_id.';

REVOKE EXECUTE ON FUNCTION create_webhook_endpoint_with_secret(uuid, text, text[], text, uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION create_webhook_endpoint_with_secret(uuid, text, text[], text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION create_webhook_endpoint_with_secret(uuid, text, text[], text, uuid, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION create_webhook_endpoint_with_secret(uuid, text, text[], text, uuid, text) TO service_role;
