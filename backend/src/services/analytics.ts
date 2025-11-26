import { getPool } from '../db/init';
import { logger } from '../utils/logger';

// Event types that can be tracked
export type AnalyticsEventType =
  | 'session_started'
  | 'session_ended'
  | 'button_clicked'
  | 'intake_flow_started'
  | 'intake_step_completed'
  | 'intake_flow_completed'
  | 'intake_flow_abandoned'
  | 'faq_category_viewed'
  | 'faq_question_viewed'
  | 'faq_resolution_feedback'
  | 'back_button_used'
  | 'phi_warning_triggered'
  | 'error_occurred'
  | 'chat_opened'
  | 'chat_closed';

// Event data structure
export interface AnalyticsEvent {
  session_id: string;
  event_type: AnalyticsEventType;
  metadata?: Record<string, any>;
  ip_hash?: string;
}

// Metrics data structures
export interface SessionMetrics {
  total_sessions: number;
  avg_duration_seconds: number;
  avg_messages_per_session: number;
  bounce_rate: number; // % of sessions with d1 message
}

export interface DailyMetrics {
  date: string;
  total_sessions: number;
  unique_sessions: number;
  handoff_requests: number;
  conversion_rate: number; // % of sessions that resulted in handoff
}

export interface FAQMetric {
  category: string;
  question_id?: string;
  view_count: number;
  helpful_count?: number;
  not_helpful_count?: number;
  resolution_rate?: number; // % marked as helpful
}

export interface IntakeMetrics {
  service_type: string;
  started_count: number;
  completed_count: number;
  abandoned_count: number;
  completion_rate: number; // % completed / started
  avg_duration_seconds: number;
  common_abandonment_step?: string;
}

export interface ConversionMetrics {
  total_sessions: number;
  handoff_requests: number;
  conversion_rate: number;
  by_service_type: {
    service_type: string;
    count: number;
    percentage: number;
  }[];
}

/**
 * Save an analytics event to the database
 * Falls back to logging if database is unavailable
 */
export async function saveEvent(event: AnalyticsEvent): Promise<boolean> {
  // Always log the event for debugging
  logger.info('analytics_event', {
    session_id: event.session_id,
    event_type: event.event_type,
    metadata_keys: event.metadata ? Object.keys(event.metadata) : [],
  });

  // Check if analytics is enabled
  if (process.env.ANALYTICS_ENABLED === 'false') {
    return true; // Silently succeed if disabled
  }

  // Check if database is available
  if (!process.env.DATABASE_URL) {
    logger.debug('analytics_database_unavailable', {
      message: 'DATABASE_URL not set, analytics event logged only',
    });
    return true; // Succeed without saving to DB
  }

  try {
    const pool = getPool();

    await pool.query(
      `INSERT INTO analytics_events (session_id, event_type, metadata, ip_hash)
       VALUES ($1, $2, $3, $4)`,
      [
        event.session_id,
        event.event_type,
        JSON.stringify(event.metadata || {}),
        event.ip_hash || null,
      ]
    );

    logger.debug('analytics_event_saved', {
      event_type: event.event_type,
      session_id: event.session_id,
    });

    return true;
  } catch (error) {
    logger.error('analytics_event_save_failed', {
      error: String(error),
      event_type: event.event_type,
    });
    return false; // Fail silently - don't disrupt user experience
  }
}

/**
 * Get session metrics for a date range
 */
export async function getSessionMetrics(
  startDate: Date,
  endDate: Date
): Promise<SessionMetrics> {
  try {
    const pool = getPool();

    const result = await pool.query(
      `
      WITH session_durations AS (
        SELECT
          session_id,
          (metadata->>'duration_seconds')::numeric as duration,
          (metadata->>'message_count')::numeric as message_count
        FROM analytics_events
        WHERE event_type = 'session_ended'
          AND event_timestamp BETWEEN $1 AND $2
          AND metadata ? 'duration_seconds'
      )
      SELECT
        COUNT(*) as total_sessions,
        AVG(duration) as avg_duration_seconds,
        AVG(message_count) as avg_messages_per_session,
        (COUNT(*) FILTER (WHERE message_count <= 1)::float / NULLIF(COUNT(*), 0) * 100) as bounce_rate
      FROM session_durations;
      `,
      [startDate, endDate]
    );

    return result.rows[0] || {
      total_sessions: 0,
      avg_duration_seconds: 0,
      avg_messages_per_session: 0,
      bounce_rate: 0,
    };
  } catch (error) {
    logger.error('get_session_metrics_failed', { error: String(error) });
    throw error;
  }
}

/**
 * Get daily metrics over a date range
 */
export async function getDailyMetrics(
  startDate: Date,
  endDate: Date
): Promise<DailyMetrics[]> {
  try {
    const pool = getPool();

    const result = await pool.query(
      `
      WITH daily_sessions AS (
        SELECT
          DATE(event_timestamp) as date,
          COUNT(DISTINCT session_id) as unique_sessions
        FROM analytics_events
        WHERE event_timestamp BETWEEN $1 AND $2
        GROUP BY DATE(event_timestamp)
      ),
      daily_handoffs AS (
        SELECT
          DATE(created_at) as date,
          COUNT(*) as handoff_requests
        FROM handoffs
        WHERE created_at BETWEEN $1 AND $2
        GROUP BY DATE(created_at)
      )
      SELECT
        ds.date::text,
        ds.unique_sessions as total_sessions,
        ds.unique_sessions as unique_sessions,
        COALESCE(dh.handoff_requests, 0) as handoff_requests,
        CASE
          WHEN ds.unique_sessions > 0
          THEN (COALESCE(dh.handoff_requests, 0)::float / ds.unique_sessions * 100)
          ELSE 0
        END as conversion_rate
      FROM daily_sessions ds
      LEFT JOIN daily_handoffs dh ON ds.date = dh.date
      ORDER BY ds.date DESC;
      `,
      [startDate, endDate]
    );

    return result.rows;
  } catch (error) {
    logger.error('get_daily_metrics_failed', { error: String(error) });
    throw error;
  }
}

/**
 * Get popular FAQs by view count
 */
export async function getPopularFAQs(
  startDate: Date,
  endDate: Date,
  limit: number = 10
): Promise<FAQMetric[]> {
  try {
    const pool = getPool();

    const result = await pool.query(
      `
      WITH faq_views AS (
        SELECT
          metadata->>'category' as category,
          metadata->>'question_id' as question_id,
          COUNT(*) as view_count
        FROM analytics_events
        WHERE event_type = 'faq_question_viewed'
          AND event_timestamp BETWEEN $1 AND $2
          AND metadata ? 'category'
          AND metadata ? 'question_id'
        GROUP BY metadata->>'category', metadata->>'question_id'
      ),
      faq_feedback AS (
        SELECT
          metadata->>'question_id' as question_id,
          COUNT(*) FILTER (WHERE (metadata->>'helpful')::boolean = true) as helpful_count,
          COUNT(*) FILTER (WHERE (metadata->>'helpful')::boolean = false) as not_helpful_count
        FROM analytics_events
        WHERE event_type = 'faq_resolution_feedback'
          AND event_timestamp BETWEEN $1 AND $2
          AND metadata ? 'question_id'
        GROUP BY metadata->>'question_id'
      )
      SELECT
        fv.category,
        fv.question_id,
        fv.view_count,
        COALESCE(ff.helpful_count, 0) as helpful_count,
        COALESCE(ff.not_helpful_count, 0) as not_helpful_count,
        CASE
          WHEN (COALESCE(ff.helpful_count, 0) + COALESCE(ff.not_helpful_count, 0)) > 0
          THEN (ff.helpful_count::float / (ff.helpful_count + ff.not_helpful_count) * 100)
          ELSE NULL
        END as resolution_rate
      FROM faq_views fv
      LEFT JOIN faq_feedback ff ON fv.question_id = ff.question_id
      ORDER BY fv.view_count DESC
      LIMIT $3;
      `,
      [startDate, endDate, limit]
    );

    return result.rows;
  } catch (error) {
    logger.error('get_popular_faqs_failed', { error: String(error) });
    throw error;
  }
}

/**
 * Get intake flow metrics by service type
 */
export async function getIntakeMetrics(
  startDate: Date,
  endDate: Date
): Promise<IntakeMetrics[]> {
  try {
    const pool = getPool();

    const result = await pool.query(
      `
      WITH intake_started AS (
        SELECT
          metadata->>'service_type' as service_type,
          COUNT(*) as started_count
        FROM analytics_events
        WHERE event_type = 'intake_flow_started'
          AND event_timestamp BETWEEN $1 AND $2
          AND metadata ? 'service_type'
        GROUP BY metadata->>'service_type'
      ),
      intake_completed AS (
        SELECT
          metadata->>'service_type' as service_type,
          COUNT(*) as completed_count,
          AVG((metadata->>'total_duration_seconds')::numeric) as avg_duration
        FROM analytics_events
        WHERE event_type = 'intake_flow_completed'
          AND event_timestamp BETWEEN $1 AND $2
          AND metadata ? 'service_type'
        GROUP BY metadata->>'service_type'
      ),
      intake_abandoned AS (
        SELECT
          metadata->>'service_type' as service_type,
          COUNT(*) as abandoned_count,
          MODE() WITHIN GROUP (ORDER BY metadata->>'last_completed_step') as common_abandonment_step
        FROM analytics_events
        WHERE event_type = 'intake_flow_abandoned'
          AND event_timestamp BETWEEN $1 AND $2
          AND metadata ? 'service_type'
        GROUP BY metadata->>'service_type'
      )
      SELECT
        ist.service_type,
        ist.started_count,
        COALESCE(ic.completed_count, 0) as completed_count,
        COALESCE(ia.abandoned_count, 0) as abandoned_count,
        CASE
          WHEN ist.started_count > 0
          THEN (COALESCE(ic.completed_count, 0)::float / ist.started_count * 100)
          ELSE 0
        END as completion_rate,
        COALESCE(ic.avg_duration, 0) as avg_duration_seconds,
        ia.common_abandonment_step
      FROM intake_started ist
      LEFT JOIN intake_completed ic ON ist.service_type = ic.service_type
      LEFT JOIN intake_abandoned ia ON ist.service_type = ia.service_type
      ORDER BY ist.started_count DESC;
      `,
      [startDate, endDate]
    );

    return result.rows;
  } catch (error) {
    logger.error('get_intake_metrics_failed', { error: String(error) });
    throw error;
  }
}

/**
 * Get conversion metrics (sessions to handoffs)
 */
export async function getConversionMetrics(
  startDate: Date,
  endDate: Date
): Promise<ConversionMetrics> {
  try {
    const pool = getPool();

    // Get total sessions
    const sessionsResult = await pool.query(
      `
      SELECT COUNT(DISTINCT session_id) as total_sessions
      FROM analytics_events
      WHERE event_type = 'session_started'
        AND event_timestamp BETWEEN $1 AND $2;
      `,
      [startDate, endDate]
    );

    // Get handoff requests by service type
    const handoffsResult = await pool.query(
      `
      WITH total AS (
        SELECT COUNT(*) as total_count
        FROM handoffs
        WHERE created_at BETWEEN $1 AND $2
      )
      SELECT
        service_type,
        COUNT(*) as count,
        (COUNT(*)::float / NULLIF(t.total_count, 0) * 100) as percentage
      FROM handoffs, total t
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY service_type, t.total_count
      ORDER BY count DESC;
      `,
      [startDate, endDate]
    );

    const totalSessions = parseInt(sessionsResult.rows[0]?.total_sessions || '0');
    const totalHandoffs = handoffsResult.rows.reduce(
      (sum, row) => sum + parseInt(row.count),
      0
    );

    return {
      total_sessions: totalSessions,
      handoff_requests: totalHandoffs,
      conversion_rate:
        totalSessions > 0 ? (totalHandoffs / totalSessions) * 100 : 0,
      by_service_type: handoffsResult.rows.map((row) => ({
        service_type: row.service_type,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage),
      })),
    };
  } catch (error) {
    logger.error('get_conversion_metrics_failed', { error: String(error) });
    throw error;
  }
}

/**
 * Get metrics for the past week (for weekly report)
 */
export async function getWeeklyMetrics(): Promise<{
  session_metrics: SessionMetrics;
  daily_metrics: DailyMetrics[];
  popular_faqs: FAQMetric[];
  intake_metrics: IntakeMetrics[];
  conversion_metrics: ConversionMetrics;
  phi_warnings_count: number;
  errors_count: number;
}> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  try {
    const pool = getPool();

    // Get PHI warnings count
    const phiResult = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'phi_warning_triggered'
        AND event_timestamp BETWEEN $1 AND $2;
      `,
      [startDate, endDate]
    );

    // Get errors count
    const errorsResult = await pool.query(
      `
      SELECT COUNT(*) as count
      FROM analytics_events
      WHERE event_type = 'error_occurred'
        AND event_timestamp BETWEEN $1 AND $2;
      `,
      [startDate, endDate]
    );

    const [
      sessionMetrics,
      dailyMetrics,
      popularFAQs,
      intakeMetrics,
      conversionMetrics,
    ] = await Promise.all([
      getSessionMetrics(startDate, endDate),
      getDailyMetrics(startDate, endDate),
      getPopularFAQs(startDate, endDate, 5),
      getIntakeMetrics(startDate, endDate),
      getConversionMetrics(startDate, endDate),
    ]);

    return {
      session_metrics: sessionMetrics,
      daily_metrics: dailyMetrics,
      popular_faqs: popularFAQs,
      intake_metrics: intakeMetrics,
      conversion_metrics: conversionMetrics,
      phi_warnings_count: parseInt(phiResult.rows[0]?.count || '0'),
      errors_count: parseInt(errorsResult.rows[0]?.count || '0'),
    };
  } catch (error) {
    logger.error('get_weekly_metrics_failed', { error: String(error) });
    throw error;
  }
}

/**
 * Get peak usage hours (for optimization insights)
 */
export async function getPeakUsageHours(
  startDate: Date,
  endDate: Date
): Promise<{ hour: number; session_count: number }[]> {
  try {
    const pool = getPool();

    const result = await pool.query(
      `
      SELECT
        EXTRACT(HOUR FROM event_timestamp)::integer as hour,
        COUNT(DISTINCT session_id) as session_count
      FROM analytics_events
      WHERE event_type = 'session_started'
        AND event_timestamp BETWEEN $1 AND $2
      GROUP BY EXTRACT(HOUR FROM event_timestamp)
      ORDER BY hour;
      `,
      [startDate, endDate]
    );

    return result.rows;
  } catch (error) {
    logger.error('get_peak_usage_hours_failed', { error: String(error) });
    throw error;
  }
}
