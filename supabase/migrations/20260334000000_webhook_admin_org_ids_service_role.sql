-- Allow service_role to execute webhook_admin_org_ids() so that
-- get_webhook_endpoint_stats (SECURITY DEFINER, callable only by service_role)
-- can invoke it when checking admin access in non-superuser configurations.
GRANT EXECUTE ON FUNCTION public.webhook_admin_org_ids() TO service_role;
