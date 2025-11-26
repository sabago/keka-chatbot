-- Keka Chatbot Analytics Events Table
-- HIPAA-compliant event tracking for chatbot usage analytics
-- No PII or PHI stored - only session IDs, event types, and metadata

CREATE TABLE IF NOT EXISTS analytics_events (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Session tracking (UUID is not personally identifiable)
    session_id UUID NOT NULL,

    -- Event classification
    event_type VARCHAR(50) NOT NULL,

    -- Timestamp
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Flexible metadata storage (JSONB for queryability)
    metadata JSONB DEFAULT '{}',

    -- Privacy: hashed IP address (for abuse detection, not user tracking)
    ip_hash VARCHAR(64),

    -- Indexes for common query patterns
    CONSTRAINT valid_event_type CHECK (event_type IN (
        'session_started',
        'session_ended',
        'button_clicked',
        'intake_flow_started',
        'intake_step_completed',
        'intake_flow_completed',
        'intake_flow_abandoned',
        'faq_category_viewed',
        'faq_question_viewed',
        'faq_resolution_feedback',
        'back_button_used',
        'phi_warning_triggered',
        'error_occurred',
        'chat_opened',
        'chat_closed'
    ))
);

-- Index for querying by event type
CREATE INDEX IF NOT EXISTS idx_analytics_event_type ON analytics_events(event_type);

-- Index for time-based queries (most common use case)
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON analytics_events(event_timestamp DESC);

-- Index for session-based queries
CREATE INDEX IF NOT EXISTS idx_analytics_session ON analytics_events(session_id);

-- Composite index for event type + time range queries
CREATE INDEX IF NOT EXISTS idx_analytics_type_time ON analytics_events(event_type, event_timestamp DESC);

-- Index for metadata queries (GIN index for JSONB)
CREATE INDEX IF NOT EXISTS idx_analytics_metadata ON analytics_events USING GIN(metadata);

-- Optional: Add data retention policy (delete events older than 90 days)
-- This keeps database size manageable and aligns with typical analytics retention
CREATE OR REPLACE FUNCTION delete_old_analytics_events()
RETURNS void AS $$
BEGIN
    DELETE FROM analytics_events
    WHERE event_timestamp < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to log deletions (optional, for audit purposes)
CREATE OR REPLACE FUNCTION log_analytics_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Log to system (could be extended to write to audit table)
    RAISE NOTICE 'Deleted analytics event: id=%, type=%, timestamp=%',
        OLD.id, OLD.event_type, OLD.event_timestamp;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE analytics_events IS 'HIPAA-compliant analytics events for chatbot usage tracking. No PII/PHI stored.';
COMMENT ON COLUMN analytics_events.session_id IS 'UUID generated client-side, not personally identifiable';
COMMENT ON COLUMN analytics_events.event_type IS 'Type of event (must match CHECK constraint)';
COMMENT ON COLUMN analytics_events.metadata IS 'Event-specific data in JSON format (button labels, durations, etc.)';
COMMENT ON COLUMN analytics_events.ip_hash IS 'SHA-256 hashed IP address with salt, used for abuse detection only';

-- Create materialized view for daily metrics (refresh nightly for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_analytics_summary AS
SELECT
    DATE(event_timestamp) as date,
    event_type,
    COUNT(*) as event_count,
    COUNT(DISTINCT session_id) as unique_sessions,
    AVG((metadata->>'duration_seconds')::numeric) FILTER (WHERE metadata ? 'duration_seconds') as avg_duration
FROM analytics_events
WHERE event_timestamp > NOW() - INTERVAL '90 days'
GROUP BY DATE(event_timestamp), event_type
ORDER BY date DESC, event_count DESC;

-- Index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_summary_date_type ON daily_analytics_summary(date, event_type);

-- Create materialized view for popular FAQs
CREATE MATERIALIZED VIEW IF NOT EXISTS popular_faqs AS
SELECT
    metadata->>'category' as category,
    metadata->>'question_id' as question_id,
    COUNT(*) as view_count,
    DATE_TRUNC('week', event_timestamp) as week
FROM analytics_events
WHERE event_type = 'faq_question_viewed'
    AND event_timestamp > NOW() - INTERVAL '90 days'
    AND metadata ? 'category'
    AND metadata ? 'question_id'
GROUP BY metadata->>'category', metadata->>'question_id', DATE_TRUNC('week', event_timestamp)
ORDER BY week DESC, view_count DESC;

-- Function to refresh materialized views (call this nightly via cron)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_analytics_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY popular_faqs;
END;
$$ LANGUAGE plpgsql;
