-- Billing Alerts Table
-- Stores alerts for webhook failures, reconcile drift, etc.

CREATE TABLE IF NOT EXISTS billing_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type TEXT NOT NULL, -- 'webhook_failure', 'reconcile_drift', 'status_mismatch'
    severity TEXT NOT NULL DEFAULT 'warning', -- 'critical', 'warning', 'info'
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_alerts_type ON billing_alerts(alert_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_resolved ON billing_alerts(resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_severity ON billing_alerts(severity, resolved, created_at DESC);

-- RLS Policies
ALTER TABLE billing_alerts ENABLE ROW LEVEL SECURITY;

-- Users can read billing alerts (for admin dashboard)
DROP POLICY IF EXISTS "Users can read billing alerts" ON billing_alerts;
CREATE POLICY "Users can read billing alerts"
    ON billing_alerts
    FOR SELECT
    USING (true); -- Allow all authenticated users (restrict to admin later)

-- Service role can insert (backend-only)
DROP POLICY IF EXISTS "Service role can insert billing alerts" ON billing_alerts;
CREATE POLICY "Service role can insert billing alerts"
    ON billing_alerts
    FOR INSERT
    WITH CHECK (false); -- Block all inserts via RLS, backend uses service role

COMMENT ON TABLE billing_alerts IS 'Alerts for billing system issues (webhook failures, reconcile drift, etc.)';
