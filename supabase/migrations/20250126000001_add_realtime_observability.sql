-- Realtime Events Observability Views
-- Useful for monitoring event pipeline health

-- View: Events per hour (for monitoring)
CREATE OR REPLACE VIEW realtime_events_hourly_stats AS
SELECT 
    DATE_TRUNC('hour', created_at) AS hour,
    organization_id,
    event_type,
    COUNT(*) AS event_count,
    COUNT(DISTINCT entity_id) AS unique_entities
FROM realtime_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), organization_id, event_type
ORDER BY hour DESC, event_count DESC;

-- View: Deduplication stats (how often dedupe_key is used)
CREATE OR REPLACE VIEW realtime_events_dedupe_stats AS
SELECT 
    DATE_TRUNC('hour', created_at) AS hour,
    organization_id,
    COUNT(*) AS total_events,
    COUNT(DISTINCT dedupe_key) FILTER (WHERE dedupe_key IS NOT NULL) AS dedupe_keys_used,
    COUNT(*) FILTER (WHERE dedupe_key IS NOT NULL) AS deduped_events,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE dedupe_key IS NOT NULL) / NULLIF(COUNT(*), 0),
        2
    ) AS dedupe_percentage
FROM realtime_events
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', created_at), organization_id
ORDER BY hour DESC;

-- View: Cleanup stats (for retention monitoring)
CREATE OR REPLACE VIEW realtime_events_cleanup_stats AS
SELECT 
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS events_created,
    COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '24 hours') AS events_eligible_for_cleanup
FROM realtime_events
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY day DESC;

-- Grant read access to authenticated users (for dashboard queries)
GRANT SELECT ON realtime_events_hourly_stats TO authenticated;
GRANT SELECT ON realtime_events_dedupe_stats TO authenticated;
GRANT SELECT ON realtime_events_cleanup_stats TO authenticated;

COMMENT ON VIEW realtime_events_hourly_stats IS 'Hourly event counts per org/type for monitoring';
COMMENT ON VIEW realtime_events_dedupe_stats IS 'Deduplication statistics for rate limiting monitoring';
COMMENT ON VIEW realtime_events_cleanup_stats IS 'Cleanup eligibility stats for retention monitoring';
