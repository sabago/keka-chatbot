import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger';
import {
  getWeeklyMetrics,
  getSessionMetrics,
  getDailyMetrics,
  getPopularFAQs,
  getIntakeMetrics,
  getConversionMetrics,
  getPeakUsageHours,
} from '../services/analytics';

const router = Router();

/**
 * GET /api/analytics/weekly
 * Get comprehensive weekly metrics summary
 */
router.get('/analytics/weekly', async (req: Request, res: Response) => {
  try {
    const metrics = await getWeeklyMetrics();
    res.json(metrics);
  } catch (error) {
    logger.error('analytics_weekly_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch weekly metrics' });
  }
});

/**
 * GET /api/analytics/sessions?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Get session metrics for date range
 */
router.get('/analytics/sessions', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates required' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const metrics = await getSessionMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    logger.error('analytics_sessions_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch session metrics' });
  }
});

/**
 * GET /api/analytics/daily?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Get daily metrics for date range
 */
router.get('/analytics/daily', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates required' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const metrics = await getDailyMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    logger.error('analytics_daily_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch daily metrics' });
  }
});

/**
 * GET /api/analytics/faqs?start=YYYY-MM-DD&end=YYYY-MM-DD&limit=10
 * Get popular FAQs
 */
router.get('/analytics/faqs', async (req: Request, res: Response) => {
  try {
    const { start, end, limit } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates required' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);
    const limitNum = limit ? parseInt(limit as string) : 10;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const faqs = await getPopularFAQs(startDate, endDate, limitNum);
    res.json(faqs);
  } catch (error) {
    logger.error('analytics_faqs_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch FAQ metrics' });
  }
});

/**
 * GET /api/analytics/intake?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Get intake flow metrics
 */
router.get('/analytics/intake', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates required' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const metrics = await getIntakeMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    logger.error('analytics_intake_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch intake metrics' });
  }
});

/**
 * GET /api/analytics/conversion?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Get conversion metrics (sessions to handoffs)
 */
router.get('/analytics/conversion', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates required' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const metrics = await getConversionMetrics(startDate, endDate);
    res.json(metrics);
  } catch (error) {
    logger.error('analytics_conversion_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch conversion metrics' });
  }
});

/**
 * GET /api/analytics/peak-hours?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Get peak usage hours
 */
router.get('/analytics/peak-hours', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates required' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const hours = await getPeakUsageHours(startDate, endDate);
    res.json(hours);
  } catch (error) {
    logger.error('analytics_peak_hours_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch peak hours' });
  }
});

/**
 * GET /api/analytics/active-sessions
 * Get currently active sessions (real-time)
 */
router.get('/analytics/active-sessions', async (req: Request, res: Response) => {
  try {
    const { getPool } = await import('../db/init');
    const pool = getPool();

    // Sessions that started in last hour but haven't ended yet
    const result = await pool.query(`
      WITH started_sessions AS (
        SELECT DISTINCT session_id, event_timestamp as start_time
        FROM analytics_events
        WHERE event_type = 'session_started'
          AND event_timestamp > NOW() - INTERVAL '1 hour'
      ),
      ended_sessions AS (
        SELECT DISTINCT session_id
        FROM analytics_events
        WHERE event_type = 'session_ended'
          AND event_timestamp > NOW() - INTERVAL '1 hour'
      )
      SELECT
        COUNT(*) as active_count,
        ARRAY_AGG(s.session_id) as active_session_ids,
        MIN(s.start_time) as oldest_session_start,
        MAX(s.start_time) as newest_session_start
      FROM started_sessions s
      WHERE NOT EXISTS (
        SELECT 1 FROM ended_sessions e WHERE e.session_id = s.session_id
      );
    `);

    res.json({
      active_sessions: parseInt(result.rows[0]?.active_count || '0'),
      oldest_session_start: result.rows[0]?.oldest_session_start,
      newest_session_start: result.rows[0]?.newest_session_start,
      session_ids: result.rows[0]?.active_session_ids || [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('analytics_active_sessions_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch active sessions' });
  }
});

/**
 * GET /api/analytics/concurrent-peak?start=YYYY-MM-DD&end=YYYY-MM-DD
 * Get peak concurrent sessions for date range
 */
router.get('/analytics/concurrent-peak', async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;

    if (!start || !end) {
      return res.status(400).json({ error: 'start and end dates required' });
    }

    const startDate = new Date(start as string);
    const endDate = new Date(end as string);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date format' });
    }

    const { getPool } = await import('../db/init');
    const pool = getPool();

    const result = await pool.query(`
      WITH session_times AS (
        SELECT
          s.session_id,
          s.event_timestamp as start_time,
          COALESCE(
            e.event_timestamp,
            s.event_timestamp + INTERVAL '1 hour'
          ) as end_time
        FROM analytics_events s
        LEFT JOIN analytics_events e
          ON s.session_id = e.session_id
          AND e.event_type = 'session_ended'
        WHERE s.event_type = 'session_started'
          AND s.event_timestamp BETWEEN $1 AND $2
      ),
      time_points AS (
        SELECT start_time as time_point, 1 as change FROM session_times
        UNION ALL
        SELECT end_time as time_point, -1 as change FROM session_times
      ),
      concurrent_counts AS (
        SELECT
          time_point,
          SUM(change) OVER (ORDER BY time_point) as concurrent_sessions
        FROM time_points
      )
      SELECT
        MAX(concurrent_sessions) as peak_concurrent,
        (SELECT time_point
         FROM concurrent_counts
         WHERE concurrent_sessions = (SELECT MAX(concurrent_sessions) FROM concurrent_counts)
         ORDER BY time_point
         LIMIT 1) as peak_time
      FROM concurrent_counts;
    `, [startDate, endDate]);

    res.json({
      peak_concurrent_sessions: parseInt(result.rows[0]?.peak_concurrent || '0'),
      peak_time: result.rows[0]?.peak_time,
      date_range: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      },
    });
  } catch (error) {
    logger.error('analytics_concurrent_peak_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to fetch concurrent peak' });
  }
});

/**
 * POST /api/analytics/send-report
 * Manually trigger weekly email report
 */
router.post('/analytics/send-report', async (req: Request, res: Response) => {
  try {
    const { sendWeeklyReport } = await import('../services/emailReport');

    logger.info('manual_report_triggered', { timestamp: new Date().toISOString() });

    const sent = await sendWeeklyReport();

    if (sent) {
      res.json({
        success: true,
        message: 'Weekly report sent successfully',
      });
    } else {
      res.status(500).json({
        error: 'Failed to send report - check configuration',
      });
    }
  } catch (error) {
    logger.error('analytics_send_report_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to send report' });
  }
});

/**
 * GET /api/analytics/report-preview
 * Get HTML preview of weekly report (for testing)
 */
router.get('/analytics/report-preview', async (req: Request, res: Response) => {
  try {
    const { generateReportPreview } = await import('../services/emailReport');
    const html = await generateReportPreview();
    res.header('Content-Type', 'text/html').send(html);
  } catch (error) {
    logger.error('analytics_report_preview_failed', { error: String(error) });
    res.status(500).json({ error: 'Failed to generate report preview' });
  }
});

export default router;
