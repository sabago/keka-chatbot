# Analytics Queries Documentation

This document provides SQL queries for analyzing chatbot usage data from the `analytics_events` table.

## Table of Contents
1. [Database Schema](#database-schema)
2. [Basic Queries](#basic-queries)
3. [Session Analytics](#session-analytics)
4. [FAQ Analytics](#faq-analytics)
5. [Intake Flow Analytics](#intake-flow-analytics)
6. [Conversion Analytics](#conversion-analytics)
7. [Trend Analysis](#trend-analysis)
8. [Performance Monitoring](#performance-monitoring)

---

## Database Schema

### analytics_events Table

```sql
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    ip_hash VARCHAR(64)
);
```

**Event Types:**
- `session_started` - User opens chat
- `session_ended` - User closes chat (metadata: duration_seconds, message_count)
- `button_clicked` - Button pressed (metadata: button_label, button_value, current_state)
- `intake_flow_started` - Intake process begun (metadata: service_type)
- `intake_step_completed` - Intake step done (metadata: service_type, step, time_spent_seconds)
- `intake_flow_completed` - Intake finished (metadata: service_type, total_duration_seconds)
- `intake_flow_abandoned` - Intake exited early (metadata: service_type, last_completed_step)
- `faq_category_viewed` - FAQ category opened (metadata: category)
- `faq_question_viewed` - FAQ question read (metadata: category, question_id)
- `faq_resolution_feedback` - "Did this help?" response (metadata: question_id, helpful)
- `back_button_used` - Back navigation (metadata: from_state, to_state)
- `phi_warning_triggered` - PHI detected
- `error_occurred` - Error happened (metadata: error_type, error_code)

---

## Basic Queries

### Total Events

```sql
SELECT COUNT(*) as total_events
FROM analytics_events;
```

### Events by Type

```sql
SELECT
    event_type,
    COUNT(*) as count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) as percentage
FROM analytics_events
GROUP BY event_type
ORDER BY count DESC;
```

### Events in Last 24 Hours

```sql
SELECT
    event_type,
    COUNT(*) as count
FROM analytics_events
WHERE event_timestamp > NOW() - INTERVAL '24 hours'
GROUP BY event_type
ORDER BY count DESC;
```

---

## Session Analytics

### Daily Active Sessions

```sql
SELECT
    DATE(event_timestamp) as date,
    COUNT(DISTINCT session_id) as unique_sessions
FROM analytics_events
WHERE event_type = 'session_started'
    AND event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(event_timestamp)
ORDER BY date DESC;
```

### Average Session Duration

```sql
SELECT
    AVG((metadata->>'duration_seconds')::numeric) as avg_duration_seconds,
    MIN((metadata->>'duration_seconds')::numeric) as min_duration,
    MAX((metadata->>'duration_seconds')::numeric) as max_duration
FROM analytics_events
WHERE event_type = 'session_ended'
    AND metadata ? 'duration_seconds'
    AND event_timestamp > NOW() - INTERVAL '7 days';
```

### Messages Per Session Distribution

```sql
SELECT
    (metadata->>'message_count')::integer as messages,
    COUNT(*) as session_count
FROM analytics_events
WHERE event_type = 'session_ended'
    AND metadata ? 'message_count'
    AND event_timestamp > NOW() - INTERVAL '7 days'
GROUP BY (metadata->>'message_count')::integer
ORDER BY messages;
```

### Bounce Rate (d1 message sessions)

```sql
SELECT
    COUNT(*) FILTER (WHERE (metadata->>'message_count')::integer <= 1) as bounced_sessions,
    COUNT(*) as total_sessions,
    ROUND(100.0 * COUNT(*) FILTER (WHERE (metadata->>'message_count')::integer <= 1) / COUNT(*), 2) as bounce_rate_percent
FROM analytics_events
WHERE event_type = 'session_ended'
    AND metadata ? 'message_count'
    AND event_timestamp > NOW() - INTERVAL '7 days';
```

---

## FAQ Analytics

### Most Viewed FAQ Questions

```sql
SELECT
    metadata->>'category' as category,
    metadata->>'question_id' as question_id,
    COUNT(*) as view_count
FROM analytics_events
WHERE event_type = 'faq_question_viewed'
    AND event_timestamp > NOW() - INTERVAL '30 days'
    AND metadata ? 'category'
    AND metadata ? 'question_id'
GROUP BY metadata->>'category', metadata->>'question_id'
ORDER BY view_count DESC
LIMIT 10;
```

### FAQ Resolution Rate

```sql
WITH faq_views AS (
    SELECT
        metadata->>'question_id' as question_id,
        COUNT(*) as view_count
    FROM analytics_events
    WHERE event_type = 'faq_question_viewed'
        AND event_timestamp > NOW() - INTERVAL '30 days'
    GROUP BY metadata->>'question_id'
),
faq_feedback AS (
    SELECT
        metadata->>'question_id' as question_id,
        COUNT(*) FILTER (WHERE (metadata->>'helpful')::boolean = true) as helpful_count,
        COUNT(*) FILTER (WHERE (metadata->>'helpful')::boolean = false) as not_helpful_count
    FROM analytics_events
    WHERE event_type = 'faq_resolution_feedback'
        AND event_timestamp > NOW() - INTERVAL '30 days'
    GROUP BY metadata->>'question_id'
)
SELECT
    v.question_id,
    v.view_count,
    COALESCE(f.helpful_count, 0) as helpful_count,
    COALESCE(f.not_helpful_count, 0) as not_helpful_count,
    CASE
        WHEN (COALESCE(f.helpful_count, 0) + COALESCE(f.not_helpful_count, 0)) > 0
        THEN ROUND(100.0 * f.helpful_count / (f.helpful_count + f.not_helpful_count), 1)
        ELSE NULL
    END as resolution_rate_percent
FROM faq_views v
LEFT JOIN faq_feedback f ON v.question_id = f.question_id
ORDER BY v.view_count DESC;
```

### FAQ Category Popularity

```sql
SELECT
    metadata->>'category' as category,
    COUNT(*) as views
FROM analytics_events
WHERE event_type = 'faq_category_viewed'
    AND event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY metadata->>'category'
ORDER BY views DESC;
```

---

## Intake Flow Analytics

### Intake Completion Rate

```sql
WITH intake_started AS (
    SELECT
        metadata->>'service_type' as service_type,
        COUNT(*) as started_count
    FROM analytics_events
    WHERE event_type = 'intake_flow_started'
        AND event_timestamp > NOW() - INTERVAL '30 days'
    GROUP BY metadata->>'service_type'
),
intake_completed AS (
    SELECT
        metadata->>'service_type' as service_type,
        COUNT(*) as completed_count
    FROM analytics_events
    WHERE event_type = 'intake_flow_completed'
        AND event_timestamp > NOW() - INTERVAL '30 days'
    GROUP BY metadata->>'service_type'
)
SELECT
    s.service_type,
    s.started_count,
    COALESCE(c.completed_count, 0) as completed_count,
    ROUND(100.0 * COALESCE(c.completed_count, 0) / s.started_count, 1) as completion_rate_percent
FROM intake_started s
LEFT JOIN intake_completed c ON s.service_type = c.service_type
ORDER BY s.started_count DESC;
```

### Average Intake Duration by Service Type

```sql
SELECT
    metadata->>'service_type' as service_type,
    COUNT(*) as completions,
    AVG((metadata->>'total_duration_seconds')::numeric) as avg_duration_seconds,
    MIN((metadata->>'total_duration_seconds')::numeric) as min_duration,
    MAX((metadata->>'total_duration_seconds')::numeric) as max_duration
FROM analytics_events
WHERE event_type = 'intake_flow_completed'
    AND metadata ? 'total_duration_seconds'
    AND event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY metadata->>'service_type'
ORDER BY completions DESC;
```

### Common Drop-off Points

```sql
SELECT
    metadata->>'service_type' as service_type,
    metadata->>'last_completed_step' as abandonment_step,
    COUNT(*) as abandonment_count
FROM analytics_events
WHERE event_type = 'intake_flow_abandoned'
    AND event_timestamp > NOW() - INTERVAL '30 days'
    AND metadata ? 'last_completed_step'
GROUP BY metadata->>'service_type', metadata->>'last_completed_step'
ORDER BY abandonment_count DESC
LIMIT 10;
```

---

## Conversion Analytics

### Session to Handoff Conversion Rate

```sql
WITH sessions AS (
    SELECT COUNT(DISTINCT session_id) as total_sessions
    FROM analytics_events
    WHERE event_type = 'session_started'
        AND event_timestamp > NOW() - INTERVAL '7 days'
),
handoffs AS (
    SELECT COUNT(*) as handoff_count
    FROM handoffs
    WHERE created_at > NOW() - INTERVAL '7 days'
)
SELECT
    s.total_sessions,
    h.handoff_count,
    ROUND(100.0 * h.handoff_count / s.total_sessions, 2) as conversion_rate_percent
FROM sessions s, handoffs h;
```

### Conversion Funnel

```sql
WITH funnel AS (
    SELECT
        COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'session_started') as sessions_started,
        COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'intake_flow_started') as intakes_started,
        COUNT(DISTINCT session_id) FILTER (WHERE event_type = 'intake_flow_completed') as intakes_completed
    FROM analytics_events
    WHERE event_timestamp > NOW() - INTERVAL '7 days'
)
SELECT
    sessions_started,
    intakes_started,
    ROUND(100.0 * intakes_started / sessions_started, 1) as intake_start_rate,
    intakes_completed,
    ROUND(100.0 * intakes_completed / intakes_started, 1) as intake_completion_rate,
    ROUND(100.0 * intakes_completed / sessions_started, 1) as overall_conversion_rate
FROM funnel;
```

---

## Trend Analysis

### Weekly Comparison

```sql
WITH current_week AS (
    SELECT COUNT(DISTINCT session_id) as sessions
    FROM analytics_events
    WHERE event_type = 'session_started'
        AND event_timestamp > NOW() - INTERVAL '7 days'
),
previous_week AS (
    SELECT COUNT(DISTINCT session_id) as sessions
    FROM analytics_events
    WHERE event_type = 'session_started'
        AND event_timestamp BETWEEN NOW() - INTERVAL '14 days' AND NOW() - INTERVAL '7 days'
)
SELECT
    c.sessions as current_week_sessions,
    p.sessions as previous_week_sessions,
    c.sessions - p.sessions as change,
    ROUND(100.0 * (c.sessions - p.sessions) / NULLIF(p.sessions, 0), 1) as percent_change
FROM current_week c, previous_week p;
```

### Daily Trend (Last 30 Days)

```sql
SELECT
    DATE(event_timestamp) as date,
    COUNT(DISTINCT session_id) as sessions,
    COUNT(*) as total_events,
    ROUND(AVG(COUNT(*)) OVER (ORDER BY DATE(event_timestamp) ROWS BETWEEN 6 PRECEDING AND CURRENT ROW), 1) as seven_day_avg_events
FROM analytics_events
WHERE event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY DATE(event_timestamp)
ORDER BY date;
```

### Peak Usage Hours

```sql
SELECT
    EXTRACT(HOUR FROM event_timestamp)::integer as hour,
    COUNT(DISTINCT session_id) as session_count,
    COUNT(*) as event_count
FROM analytics_events
WHERE event_type = 'session_started'
    AND event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY EXTRACT(HOUR FROM event_timestamp)
ORDER BY hour;
```

### Day of Week Analysis

```sql
SELECT
    TO_CHAR(event_timestamp, 'Day') as day_of_week,
    COUNT(DISTINCT session_id) as session_count,
    AVG((SELECT (metadata->>'duration_seconds')::numeric
         FROM analytics_events e2
         WHERE e2.session_id = e1.session_id
         AND e2.event_type = 'session_ended'
         LIMIT 1)) as avg_duration
FROM analytics_events e1
WHERE event_type = 'session_started'
    AND event_timestamp > NOW() - INTERVAL '30 days'
GROUP BY TO_CHAR(event_timestamp, 'Day'), EXTRACT(DOW FROM event_timestamp)
ORDER BY EXTRACT(DOW FROM event_timestamp);
```

---

## Performance Monitoring

### Error Rate

```sql
WITH errors AS (
    SELECT COUNT(*) as error_count
    FROM analytics_events
    WHERE event_type = 'error_occurred'
        AND event_timestamp > NOW() - INTERVAL '24 hours'
),
total AS (
    SELECT COUNT(*) as total_events
    FROM analytics_events
    WHERE event_timestamp > NOW() - INTERVAL '24 hours'
)
SELECT
    e.error_count,
    t.total_events,
    ROUND(100.0 * e.error_count / NULLIF(t.total_events, 0), 3) as error_rate_percent
FROM errors e, total t;
```

### PHI Detection Rate

```sql
SELECT
    COUNT(*) as phi_warnings,
    COUNT(DISTINCT session_id) as affected_sessions
FROM analytics_events
WHERE event_type = 'phi_warning_triggered'
    AND event_timestamp > NOW() - INTERVAL '30 days';
```

### Back Button Usage Rate

```sql
WITH back_usage AS (
    SELECT COUNT(*) as back_count
    FROM analytics_events
    WHERE event_type = 'back_button_used'
        AND event_timestamp > NOW() - INTERVAL '7 days'
),
total_sessions AS (
    SELECT COUNT(DISTINCT session_id) as session_count
    FROM analytics_events
    WHERE event_type = 'session_started'
        AND event_timestamp > NOW() - INTERVAL '7 days'
)
SELECT
    b.back_count,
    t.session_count,
    ROUND(100.0 * b.back_count / t.session_count, 2) as back_per_session_percent
FROM back_usage b, total_sessions t;
```

---

## Advanced Queries

### Session Journey Analysis

```sql
SELECT
    session_id,
    ARRAY_AGG(event_type ORDER BY event_timestamp) as event_sequence,
    COUNT(*) as event_count,
    MAX(event_timestamp) - MIN(event_timestamp) as session_duration
FROM analytics_events
WHERE session_id = 'your-session-id-here'
GROUP BY session_id;
```

### User Retention (Sessions by Same IP Hash)

```sql
SELECT
    ip_hash,
    COUNT(DISTINCT session_id) as session_count,
    MIN(event_timestamp) as first_session,
    MAX(event_timestamp) as last_session,
    MAX(event_timestamp) - MIN(event_timestamp) as retention_period
FROM analytics_events
WHERE event_type = 'session_started'
    AND ip_hash IS NOT NULL
    AND event_timestamp > NOW() - INTERVAL '90 days'
GROUP BY ip_hash
HAVING COUNT(DISTINCT session_id) > 1
ORDER BY session_count DESC
LIMIT 50;
```

### Button Click Heatmap

```sql
SELECT
    metadata->>'button_label' as button_label,
    metadata->>'current_state' as state,
    COUNT(*) as click_count
FROM analytics_events
WHERE event_type = 'button_clicked'
    AND event_timestamp > NOW() - INTERVAL '30 days'
    AND metadata ? 'button_label'
GROUP BY metadata->>'button_label', metadata->>'current_state'
ORDER BY click_count DESC
LIMIT 20;
```

---

## Materialized Views

### Refresh Daily Summary View

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY daily_analytics_summary;
```

### Refresh Popular FAQs View

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY popular_faqs;
```

---

## Connecting to Database

### From Local Machine

```bash
# Get DATABASE_URL from Railway dashboard
psql "postgresql://user:password@host:port/database"
```

### From Railway CLI

```bash
railway connect postgres
```

---

## Best Practices

1. **Use Time Ranges**: Always filter by date to improve query performance
2. **Index Usage**: Queries on `event_type`, `event_timestamp`, and `session_id` are optimized
3. **JSONB Queries**: Use `?` operator to check if metadata key exists before querying
4. **Aggregations**: Use FILTER clause for conditional aggregations
5. **Materialized Views**: Refresh views daily for commonly used metrics

---

## Example Analysis Workflow

```sql
-- 1. Get overview
SELECT event_type, COUNT(*) FROM analytics_events
WHERE event_timestamp > NOW() - INTERVAL '7 days'
GROUP BY event_type;

-- 2. Check session metrics
SELECT AVG((metadata->>'duration_seconds')::numeric)
FROM analytics_events
WHERE event_type = 'session_ended'
AND event_timestamp > NOW() - INTERVAL '7 days';

-- 3. Identify top FAQs
SELECT metadata->>'question_id', COUNT(*)
FROM analytics_events
WHERE event_type = 'faq_question_viewed'
AND event_timestamp > NOW() - INTERVAL '7 days'
GROUP BY metadata->>'question_id'
ORDER BY COUNT(*) DESC LIMIT 5;

-- 4. Check conversion rate
-- (See "Session to Handoff Conversion Rate" query above)
```

---

## Support

For questions or issues with analytics:
1. Check Railway logs for errors
2. Verify DATABASE_URL is set
3. Ensure analytics_events table exists
4. Check that events are being tracked in frontend

**Database Schema Location:** `backend/src/db/analytics-schema.sql`
**Analytics Service:** `backend/src/services/analytics.ts`
**Frontend Tracking:** `frontend/src/utils/analytics.ts`
