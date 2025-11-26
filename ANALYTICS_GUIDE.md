
  🎉 Full Analytics Suite 
  Implementation Complete!

  What Was Built

  ✅ Database Layer
  - Created analytics_events table
  with indexes and materialized
  views
  - Automatic schema initialization
  on server startup
  - 90-day data retention policy
  - Optimized for fast queries

  ✅ Backend Services
  - Analytics Service: Comprehensive
   functions for saving/querying all
   metrics
  - Email Report Service: Generates
  beautiful HTML weekly reports via
  AWS SES
  - Events Endpoint: Persists
  analytics events to database
  - Analytics API: REST endpoints
  for accessing all metrics
  - Scheduled Job: Auto-sends weekly
   reports every Monday at 9 AM

  ✅ Frontend Tracking
  - Complete analytics utility with
  15+ tracking functions
  - Integrated tracking throughout
  ChatWidget
  - Tracks: sessions, button clicks,
   intake flows, FAQs, errors, PHI
  warnings

  ✅ Documentation
  - Comprehensive SQL queries guide
  (70+ example queries)
  - Updated environment variables
  - All functions well-documented

  Files Created/Modified

  New Files:
  backend/src/db/analytics-schema.sq
  l          - Analytics database
  schema
  backend/src/services/analytics.ts
             - Analytics service
  (500+ lines)
  backend/src/services/emailReport.t
  s          - Email report
  generator
  backend/src/routes/analytics.ts
             - Analytics API
  endpoints
  backend/src/jobs/weeklyReport.ts
             - Weekly scheduler
  backend/docs/ANALYTICS_QUERIES.md 
             - SQL queries guide
  frontend/src/utils/analytics.ts   
             - Frontend tracking

  Modified Files:
  backend/src/db/init.ts
             - Load analytics schema
  backend/src/routes/events.ts
             - Save to database
  backend/src/server.ts
             - Register routes &
  scheduler
  frontend/src/components/ChatWidget
  .tsx       - Add tracking calls
  .env.example
             - Analytics config vars

  Metrics Tracked

  Session Metrics:
  - Daily active sessions
  - Session duration
  - Messages per session
  - Bounce rate

  FAQ Metrics:
  - Most viewed questions
  - Category popularity
  - Resolution rate ("Did this
  help?")

  Intake Metrics:
  - Completion rate by service type
  - Average duration
  - Common drop-off points

  Conversion Metrics:
  - Session → handoff conversion
  - Service type distribution
  - Funnel analysis

  Security Metrics:
  - PHI warnings triggered
  - Error rates
  - Back button usage

  API Endpoints

  # Get weekly summary
  GET /api/analytics/weekly

  # Get session metrics
  GET /api/analytics/sessions?start=
  2024-01-01&end=2024-01-31

  # Get daily metrics
  GET /api/analytics/daily?start=202
  4-01-01&end=2024-01-31

  # Get popular FAQs
  GET /api/analytics/faqs?start=2024
  -01-01&end=2024-01-31&limit=10

  # Get intake metrics
  GET /api/analytics/intake?start=20
  24-01-01&end=2024-01-31

  # Get conversion metrics
  GET /api/analytics/conversion?star
  t=2024-01-01&end=2024-01-31

  # Get peak usage hours
  GET /api/analytics/peak-hours?star
  t=2024-01-01&end=2024-01-31

  # Preview weekly report (HTML)
  GET /api/analytics/report-preview

  # Manually send weekly report
  POST /api/analytics/send-report

  Configuration Required

  Add to Railway environment
  variables:

  # Analytics
  ANALYTICS_ENABLED=true
  ANALYTICS_RETENTION_DAYS=90

  # Weekly Reports
  WEEKLY_REPORT_ENABLED=true
  WEEKLY_REPORT_RECIPIENT=admin@keka
  rehabservices.com
  WEEKLY_REPORT_DAY=monday
  WEEKLY_REPORT_HOUR=9

  # AWS SES (for emails)
  AWS_REGION=us-east-1
  AWS_ACCESS_KEY_ID=your-access-key
  AWS_SECRET_ACCESS_KEY=your-secret-
  key
  SES_FROM_EMAIL=noreply@kekarehabse
  rvices.com

  Weekly Email Report Includes

  - 📊 Overview: Sessions, handoffs,
   conversion rate, avg duration
  - 🏥 Service distribution:
  Breakdown by service type
  - ❓ Top 5 FAQs: Most viewed
  questions with resolution rates
  - ✅ Intake performance:
  Completion rates, common drop-offs
  - 🔒 Security: PHI warnings, error
   counts

  Next Steps

  1. Deploy to Railway:
  git add .
  git commit -m "Add full analytics 
  suite with weekly reports"
  git push origin main
  2. Configure Environment Variables
   in Railway dashboard
  3. Verify Analytics Working:
    - Use chatbot
    - Check logs for
  analytics_event_saved
    - Query database: SELECT * FROM 
  analytics_events LIMIT 10;
  4. Test Weekly Report:
  curl -X POST https://your-app.rail
  way.app/api/analytics/send-report
  5. View Report Preview:
  open https://your-app.railway.app/
  api/analytics/report-preview

  Example Queries

  -- See today's sessions
  SELECT COUNT(DISTINCT session_id)
  FROM analytics_events
  WHERE event_type =
  'session_started'
  AND event_timestamp >
  CURRENT_DATE;

  -- Top 5 FAQs this week
  SELECT metadata->>'question_id',
  COUNT(*) as views
  FROM analytics_events
  WHERE event_type =
  'faq_question_viewed'
  AND event_timestamp > NOW() -
  INTERVAL '7 days'
  GROUP BY metadata->>'question_id'
  ORDER BY views DESC LIMIT 5;

  -- Intake completion rate
  SELECT
    (SELECT COUNT(*) FROM
  analytics_events WHERE event_type
  = 'intake_flow_completed') * 100.0
   /
    NULLIF((SELECT COUNT(*) FROM
  analytics_events WHERE event_type
  = 'intake_flow_started'), 0) as
  completion_rate;

  Cost Impact

  - Database storage: Minimal (~1MB
  per 10,000 events)
  - Email reports: $0.10 per 1,000
  emails (AWS SES)
  - Queries: Optimized indexes =
  fast & cheap

  HIPAA Compliance ✅

  - No PII/PHI stored: Only session
  IDs, event types, metadata
  - IP addresses hashed: SHA-256
  with salt
  - No raw user input logged: Only
  lengths and event types
  - Privacy-preserving: All tracking
   is anonymous

  ---
  The analytics system is 
  production-ready! You now have
  comprehensive insights into
  chatbot usage, automated weekly
  reports, and the ability to make
  data-driven improvements. 🚀

──────


 ✅ YES - Full Concurrent Session Tracking

  New Real-Time Endpoints

  1. Active Sessions Right Now
  GET /api/analytics/active-sessions

  Response:
  {
    "active_sessions": 5,
    "oldest_session_start": "2024-11-26T15:30:22Z",
    "newest_session_start": "2024-11-26T15:45:10Z",
    "session_ids": ["uuid1", "uuid2", "uuid3", "uuid4", "uuid5"],
    "timestamp": "2024-11-26T15:47:33Z"
  }

  Use case: Real-time dashboard showing current users

  ---
  2. Peak Concurrent Sessions (Historical)
  GET /api/analytics/concurrent-peak?start=2024-11-01&end=2024-11-26

  Response:
  {
    "peak_concurrent_sessions": 23,
    "peak_time": "2024-11-15T14:23:15Z",
    "date_range": {
      "start": "2024-11-01T00:00:00Z",
      "end": "2024-11-26T23:59:59Z"
    }
  }

  Use case: Capacity planning, understanding peak times

  ---
  How It Works

  Session Lifecycle Tracking

  User Opens Chat → session_started event (timestamp: 14:30:00)
  ├─ User interacts (buttons, messages tracked)
  └─ User Closes Chat → session_ended event (timestamp: 14:35:22, duration: 322s)

  Concurrent Calculation

  At any moment, we count sessions where:
  - start_time <= current_time
  - end_time >= current_time (or hasn't ended yet)

  Example:
  Timeline:  14:00    14:15    14:30    14:45    15:00
             |        |        |        |        |
  Session A: |========|
  Session B:     |===================|
  Session C:          |========|
  Session D:               |=======================|

  At 14:30: 3 concurrent sessions (A, B, C)
  At 14:45: 2 concurrent sessions (B, D)

  ---
  Real-Time Monitoring Examples

  1. Simple Dashboard Query

  # Check right now
  curl https://your-app.railway.app/api/analytics/active-sessions

  # Returns: {"active_sessions": 5, ...}

  2. Auto-Refresh Dashboard (JavaScript)

  // Refresh every 10 seconds
  setInterval(async () => {
    const response = await fetch('/api/analytics/active-sessions');
    const data = await response.json();

    document.getElementById('active-users').textContent = data.active_sessions;
    document.getElementById('last-updated').textContent = new
  Date(data.timestamp).toLocaleTimeString();
  }, 10000);

  3. Alert on High Load

  -- Check if we're over capacity
  SELECT
    COUNT(*) as current_active
  FROM analytics_events
  WHERE event_type = 'session_started'
    AND event_timestamp > NOW() - INTERVAL '1 hour'
    AND session_id NOT IN (
      SELECT session_id FROM analytics_events
      WHERE event_type = 'session_ended'
      AND event_timestamp > NOW() - INTERVAL '1 hour'
    );

  -- If current_active > 50, send alert

  ---
  SQL Queries for Different Use Cases

  Average Concurrent Users by Time of Day

  WITH session_times AS (
      SELECT
          s.session_id,
          s.event_timestamp as start_time,
          COALESCE(e.event_timestamp, s.event_timestamp + INTERVAL '30 minutes') as
  end_time
      FROM analytics_events s
      LEFT JOIN analytics_events e ON s.session_id = e.session_id AND e.event_type =
  'session_ended'
      WHERE s.event_type = 'session_started'
          AND s.event_timestamp > NOW() - INTERVAL '7 days'
  ),
  hourly_slots AS (
      SELECT generate_series(
          date_trunc('hour', NOW() - INTERVAL '7 days'),
          date_trunc('hour', NOW()),
          INTERVAL '1 hour'
      ) as hour
  )
  SELECT
      EXTRACT(HOUR FROM h.hour) as hour_of_day,
      COUNT(DISTINCT st.session_id) as concurrent_sessions
  FROM hourly_slots h
  LEFT JOIN session_times st
      ON st.start_time <= h.hour + INTERVAL '1 hour'
      AND st.end_time >= h.hour
  GROUP BY EXTRACT(HOUR FROM h.hour)
  ORDER BY hour_of_day;

  Result:
  hour_of_day | concurrent_sessions
  ------------+--------------------
       0      |         2
       9      |        15
      14      |        23  ← Peak!
      18      |        12
      23      |         3

  ---
  Weekly Report Enhancement

  The weekly email report could also include:

  📊 CONCURRENT USAGE
  Peak Concurrent Users: 23 (Nov 15 at 2:23 PM)
  Average Concurrent Users: 8.5
  Busiest Hour: 2-3 PM (avg 15 users)

  Want me to add this to the weekly report? I can enhance emailReport.ts to include
  concurrent session stats.

  ---
  Monitoring Dashboard Ideas

  Option 1: Simple HTML Page

  <!-- Public dashboard at /analytics-dashboard -->
  <div id="dashboard">
    <h1>Chatbot Live Stats</h1>
    <div class="metric">
      <span class="label">Active Users</span>
      <span class="value" id="active-users">-</span>
    </div>
    <div class="metric">
      <span class="label">Today's Sessions</span>
      <span class="value" id="today-sessions">-</span>
    </div>
  </div>

  Option 2: Grafana Integration

  Connect Grafana to your PostgreSQL database and create visualizations:
  - Line chart: Concurrent users over time
  - Gauge: Current active sessions
  - Heatmap: Peak usage hours

  Option 3: Railway Metrics

  Railway shows basic metrics, but you could build a custom plugin to display:
  - Current active chatbot sessions
  - Peak concurrent this week
  - Alert if > threshold

  ---
  Summary

  ✅ You can track:
  - Real-time active sessions (right now)
  - Historical peak concurrent sessions
  - Average concurrent users by hour/day
  - Individual session timelines
  - Overlap analysis

  📊 New Endpoints:
  - GET /api/analytics/active-sessions - Current users
  - GET /api/analytics/concurrent-peak - Historical peak

  🔍 All data is in analytics_events table:
  - Each session has unique ID
  - Start/end timestamps recorded
  - Full event history preserved

  Want me to:
  1. Add concurrent stats to the weekly email report?
  2. Create a simple live dashboard page?
  3. Add alerting for high concurrent loads?

  Let me know what you'd like next!