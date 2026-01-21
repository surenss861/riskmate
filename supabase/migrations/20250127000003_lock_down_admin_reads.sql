-- Lock Down Admin-Only Reads for Billing Tables
-- Only owner/admin roles can read reconciliation_logs and billing_alerts

-- Update reconciliation_logs RLS: Admin-only reads
DROP POLICY IF EXISTS "Users can read reconciliation logs" ON reconciliation_logs;
DROP POLICY IF EXISTS "Admin/owner can read reconciliation logs" ON reconciliation_logs;
CREATE POLICY "Admin/owner can read reconciliation logs"
    ON reconciliation_logs
    FOR SELECT
    USING (
        -- Allow if user is owner/admin in any organization
        -- (reconciliation logs are org-agnostic operational data)
        EXISTS (
            SELECT 1
            FROM organization_members
            WHERE user_id = auth.uid()
              AND role IN ('owner', 'admin')
        )
        OR EXISTS (
            SELECT 1
            FROM users
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    );

-- Update billing_alerts RLS: Admin-only reads
DROP POLICY IF EXISTS "Users can read billing alerts" ON billing_alerts;
DROP POLICY IF EXISTS "Admin/owner can read billing alerts" ON billing_alerts;
CREATE POLICY "Admin/owner can read billing alerts"
    ON billing_alerts
    FOR SELECT
    USING (
        -- Allow if user is owner/admin in any organization
        -- (billing alerts are org-agnostic operational data)
        EXISTS (
            SELECT 1
            FROM organization_members
            WHERE user_id = auth.uid()
              AND role IN ('owner', 'admin')
        )
        OR EXISTS (
            SELECT 1
            FROM users
            WHERE id = auth.uid()
              AND role IN ('owner', 'admin')
        )
    );

COMMENT ON POLICY "Admin/owner can read reconciliation logs" ON reconciliation_logs IS 'Only owner/admin roles can read reconciliation logs (sensitive operational data)';
COMMENT ON POLICY "Admin/owner can read billing alerts" ON billing_alerts IS 'Only owner/admin roles can read billing alerts (sensitive operational data)';
