-- Funnel Events Table
-- Stores checkout funnel events for debugging conversions and failures

CREATE TABLE IF NOT EXISTS funnel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    event TEXT NOT NULL, -- e.g., 'pricing_view', 'checkout_clicked', 'subscription_activated'
    plan TEXT, -- 'starter', 'pro', 'business'
    session_id TEXT, -- Stripe checkout session ID
    metadata JSONB DEFAULT '{}', -- Additional context
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_funnel_events_user ON funnel_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_org ON funnel_events(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_event ON funnel_events(event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_funnel_events_session ON funnel_events(session_id) WHERE session_id IS NOT NULL;

-- RLS Policies
ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;

-- Users can read their own org's events
DROP POLICY IF EXISTS "Users can read their org's funnel events" ON funnel_events;
CREATE POLICY "Users can read their org's funnel events"
    ON funnel_events
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Service role can insert (backend-only)
-- Clients never write directly to events table
DROP POLICY IF EXISTS "Service role can insert funnel events" ON funnel_events;
CREATE POLICY "Service role can insert funnel events"
    ON funnel_events
    FOR INSERT
    WITH CHECK (false); -- Block all inserts via RLS, backend uses service role

COMMENT ON TABLE funnel_events IS 'Checkout funnel events for conversion tracking and debugging';
COMMENT ON COLUMN funnel_events.event IS 'Event name: pricing_view, plan_selected, checkout_clicked, checkout_session_created, checkout_redirected, checkout_return_success, checkout_return_cancel, subscription_activated';
COMMENT ON COLUMN funnel_events.session_id IS 'Stripe checkout session ID for correlating events';
