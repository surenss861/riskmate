-- Reconciliation Logs Table
-- Stores reconciliation runs and results for audit trail

CREATE TABLE IF NOT EXISTS reconciliation_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_type TEXT NOT NULL, -- 'scheduled', 'manual', 'webhook_failure'
    lookback_hours INTEGER NOT NULL,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT NOT NULL, -- 'success', 'partial', 'error'
    created_count INTEGER DEFAULT 0,
    updated_count INTEGER DEFAULT 0,
    mismatch_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    errors JSONB DEFAULT '[]',
    reconciliations JSONB DEFAULT '[]', -- Full reconciliation results
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'
);

-- Add run_key column if it doesn't exist (for idempotency)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='reconciliation_logs' AND column_name='run_key') THEN
    ALTER TABLE reconciliation_logs ADD COLUMN run_key TEXT;
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_started ON reconciliation_logs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_status ON reconciliation_logs(status, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_reconciliation_logs_key ON reconciliation_logs(run_key) WHERE run_key IS NOT NULL;

-- Unique constraint: only one active run per run_key (prevents duplicate runs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_reconciliation_logs_key_running 
ON reconciliation_logs(run_key) 
WHERE run_key IS NOT NULL AND status = 'running';

-- RLS Policies
ALTER TABLE reconciliation_logs ENABLE ROW LEVEL SECURITY;

-- Users can read reconciliation logs (for admin dashboard)
DROP POLICY IF EXISTS "Users can read reconciliation logs" ON reconciliation_logs;
CREATE POLICY "Users can read reconciliation logs"
    ON reconciliation_logs
    FOR SELECT
    USING (
        -- Only allow if user is admin/owner (you can add role check here)
        -- For now, allow all authenticated users (restrict later)
        true
    );

-- Service role can insert (backend-only)
DROP POLICY IF EXISTS "Service role can insert reconciliation logs" ON reconciliation_logs;
CREATE POLICY "Service role can insert reconciliation logs"
    ON reconciliation_logs
    FOR INSERT
    WITH CHECK (false); -- Block all inserts via RLS, backend uses service role

COMMENT ON TABLE reconciliation_logs IS 'Audit trail of reconciliation runs for billing consistency';
COMMENT ON COLUMN reconciliation_logs.reconciliations IS 'Full JSON array of reconciliation issues found';
