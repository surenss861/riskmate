-- Auto-update updated_at on webhook_endpoints so any update path (PATCH, RPC, etc.) keeps it current.
-- Uses existing update_updated_at_column() from initial_schema / database_hardening.
DROP TRIGGER IF EXISTS update_webhook_endpoints_updated_at ON webhook_endpoints;
CREATE TRIGGER update_webhook_endpoints_updated_at
  BEFORE UPDATE ON webhook_endpoints
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
