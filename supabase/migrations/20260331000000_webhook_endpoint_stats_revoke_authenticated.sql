-- Revoke get_webhook_endpoint_stats from authenticated and PUBLIC so only service_role can call it.
-- The intermediate migration 20260324000000 granted EXECUTE to authenticated; 20260330000000
-- made the function SECURITY DEFINER with a JWT guard but did not revoke that grant.
-- This ensures the function is only callable via the backend admin client (service_role).

REVOKE EXECUTE ON FUNCTION get_webhook_endpoint_stats(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION get_webhook_endpoint_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_webhook_endpoint_stats(uuid) TO service_role;
