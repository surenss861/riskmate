-- Realtime events table for push signals
-- Lightweight events that trigger client refreshes (not full state)

CREATE TABLE IF NOT EXISTS realtime_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL, -- e.g., 'job.created', 'job.updated', 'evidence.uploaded'
    entity_type TEXT NOT NULL, -- e.g., 'job', 'evidence', 'audit'
    entity_id TEXT, -- ID of the affected entity (job_id, document_id, etc.)
    payload JSONB DEFAULT '{}', -- Small JSON with additional context (max 2KB)
    dedupe_key TEXT, -- Optional: for deduplication (e.g., "job.updated:<job_id>:<minute>")
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Constraints
    CONSTRAINT payload_size_check CHECK (octet_length(payload::text) <= 2048) -- Max 2KB payload
);

-- Add missing columns if table already exists (idempotent)
DO $$
BEGIN
    -- Add dedupe_key column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'realtime_events' 
        AND column_name = 'dedupe_key'
    ) THEN
        ALTER TABLE realtime_events ADD COLUMN dedupe_key TEXT;
    END IF;
    
    -- Add payload_size_check constraint if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'payload_size_check' 
        AND table_name = 'realtime_events'
    ) THEN
        ALTER TABLE realtime_events ADD CONSTRAINT payload_size_check 
            CHECK (octet_length(payload::text) <= 2048);
    END IF;
END $$;

-- Indexes for performance (idempotent - won't fail if already exists)
CREATE INDEX IF NOT EXISTS idx_realtime_events_org_created ON realtime_events(organization_id, created_at DESC); -- For catch-up queries
CREATE INDEX IF NOT EXISTS idx_realtime_events_entity ON realtime_events(entity_type, entity_id) WHERE entity_id IS NOT NULL; -- For entity lookups
CREATE INDEX IF NOT EXISTS idx_realtime_events_type ON realtime_events(event_type); -- For event type filtering
CREATE INDEX IF NOT EXISTS idx_realtime_events_dedupe ON realtime_events(dedupe_key) WHERE dedupe_key IS NOT NULL; -- For deduplication (optional)

-- Enable Realtime on this table (idempotent - won't fail if already added)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' 
        AND tablename = 'realtime_events'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE realtime_events;
    END IF;
END $$;

-- RLS Policies (idempotent - won't fail if already exists)
ALTER TABLE realtime_events ENABLE ROW LEVEL SECURITY;

-- Users can only read events for their organization
DROP POLICY IF EXISTS "Users can read events for their organization" ON realtime_events;
CREATE POLICY "Users can read events for their organization"
    ON realtime_events
    FOR SELECT
    USING (
        organization_id IN (
            SELECT organization_id 
            FROM organization_members 
            WHERE user_id = auth.uid()
        )
    );

-- Only service role can insert (backend-only)
-- Clients never write directly to events table
DROP POLICY IF EXISTS "Service role can insert events" ON realtime_events;
CREATE POLICY "Service role can insert events"
    ON realtime_events
    FOR INSERT
    WITH CHECK (false); -- Block all inserts via RLS, backend uses service role

-- Retention: Delete events older than 24 hours (keep it lightweight)
-- Function is idempotent (CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION cleanup_old_realtime_events()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM realtime_events
    WHERE created_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log cleanup for monitoring
    RAISE NOTICE 'Cleaned up % realtime events older than 24 hours', deleted_count;
END;
$$;

-- Schedule cleanup daily at 2 AM (if pg_cron is enabled)
-- Run this manually in Supabase SQL editor:
-- SELECT cron.schedule('cleanup-realtime-events', '0 2 * * *', $$SELECT cleanup_old_realtime_events()$$);
-- Or run manually: SELECT cleanup_old_realtime_events();

COMMENT ON TABLE realtime_events IS 'Lightweight push signals for realtime updates. Events trigger client refreshes, not full state delivery.';
COMMENT ON COLUMN realtime_events.event_type IS 'Event type: job.created, job.updated, evidence.uploaded, audit.appended, etc.';
COMMENT ON COLUMN realtime_events.entity_type IS 'Type of entity affected: job, evidence, audit, etc.';
COMMENT ON COLUMN realtime_events.entity_id IS 'ID of the affected entity (job_id, document_id, event_id, etc.)';
COMMENT ON COLUMN realtime_events.payload IS 'Small JSON with additional context (job_id, document_id, etc.)';
