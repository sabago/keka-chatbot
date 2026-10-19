import { getWeeklyMetrics } from './analytics';
import { logger } from '../utils/logger';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { getPool } from '../db/init';
import { FAQ_CATEGORIES } from './faq';
import {
  callout,
  dataTable,
  detailRows,
  EMAIL_TIME_ZONE,
  metricTiles,
  paragraph,
  parseEmailList,
  renderEmail,
  sectionHeading,
  serviceTypeLabel,
} from '../utils/emailFormat';

// Initialize SES client
let sesClient: SESClient | null = null;

function getSESClient(): SESClient {
  if (!sesClient) {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return sesClient;
}

/**
 * Format a number with commas for readability
 */
function formatNumber(num: number): string {
  return Math.round(num).toLocaleString();
}

/**
 * Format a percentage with 1 decimal place
 */
function formatPercent(num: number): string {
  return num.toFixed(1) + '%';
}

/**
 * Calculate percentage change between two numbers
 */
function calculateChange(current: number, previous: number): string {
  if (previous === 0) return 'N/A';
  const change = ((current - previous) / previous) * 100;
  const sign = change >= 0 ? '+' : '';
  return `${sign}${formatPercent(change)}`;
}

/**
 * Format an hour of day (0-23) as "2 PM"
 */
function formatHour(hour: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${hour % 12 === 0 ? 12 : hour % 12} ${suffix}`;
}

/**
 * Format duration in seconds to human-readable format
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Readable FAQ category and question text for an analytics row
 * (falls back to the stored ids if the FAQ has since been removed)
 */
function faqLabels(categoryId?: string, questionId?: string): [string, string] {
  const category = categoryId ? FAQ_CATEGORIES[categoryId] : undefined;
  const question = category?.questions.find((q) => q.id === questionId);
  return [
    category?.label || categoryId || 'Uncategorized',
    question?.question || questionId || 'Unknown',
  ];
}

/**
 * Get concurrent session statistics for the past week
 */
async function getConcurrentStats(startDate: Date, endDate: Date): Promise<{
  peak_concurrent: number;
  peak_time: string | null;
  avg_concurrent: number;
  busiest_hour: number | null;
}> {
  try {
    const pool = getPool();

    // Get peak concurrent sessions
    const peakResult = await pool.query(`
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

    // Get average concurrent by hour
    const hourlyResult = await pool.query(`
      WITH session_times AS (
        SELECT
          s.session_id,
          s.event_timestamp as start_time,
          COALESCE(
            e.event_timestamp,
            s.event_timestamp + INTERVAL '30 minutes'
          ) as end_time
        FROM analytics_events s
        LEFT JOIN analytics_events e
          ON s.session_id = e.session_id
          AND e.event_type = 'session_ended'
        WHERE s.event_type = 'session_started'
          AND s.event_timestamp BETWEEN $1 AND $2
      ),
      hourly_slots AS (
        SELECT generate_series(
          date_trunc('hour', $1),
          date_trunc('hour', $2),
          INTERVAL '1 hour'
        ) as hour
      ),
      concurrent_per_hour AS (
        SELECT
          h.hour,
          COUNT(DISTINCT st.session_id) as concurrent_sessions
        FROM hourly_slots h
        LEFT JOIN session_times st
          ON st.start_time <= h.hour + INTERVAL '1 hour'
          AND st.end_time >= h.hour
        GROUP BY h.hour
      )
      SELECT
        EXTRACT(HOUR FROM hour AT TIME ZONE $3) as hour_of_day,
        AVG(concurrent_sessions) as avg_concurrent,
        MAX(concurrent_sessions) as max_concurrent
      FROM concurrent_per_hour
      GROUP BY EXTRACT(HOUR FROM hour AT TIME ZONE $3)
      ORDER BY max_concurrent DESC
      LIMIT 1;
    `, [startDate, endDate, EMAIL_TIME_ZONE]);

    // Calculate overall average concurrent
    const avgResult = await pool.query(`
      WITH session_times AS (
        SELECT
          s.session_id,
          s.event_timestamp as start_time,
          COALESCE(
            e.event_timestamp,
            s.event_timestamp + INTERVAL '30 minutes'
          ) as end_time
        FROM analytics_events s
        LEFT JOIN analytics_events e
          ON s.session_id = e.session_id
          AND e.event_type = 'session_ended'
        WHERE s.event_type = 'session_started'
          AND s.event_timestamp BETWEEN $1 AND $2
      ),
      hourly_slots AS (
        SELECT generate_series(
          date_trunc('hour', $1),
          date_trunc('hour', $2),
          INTERVAL '1 hour'
        ) as hour
      )
      SELECT
        AVG(concurrent_count) as overall_avg
      FROM (
        SELECT
          h.hour,
          COUNT(DISTINCT st.session_id) as concurrent_count
        FROM hourly_slots h
        LEFT JOIN session_times st
          ON st.start_time <= h.hour + INTERVAL '1 hour'
          AND st.end_time >= h.hour
        GROUP BY h.hour
      ) sub;
    `, [startDate, endDate]);

    // Check if there's meaningful data for busiest hour
    const hasMeaningfulData = hourlyResult.rows[0]?.max_concurrent &&
                              parseFloat(hourlyResult.rows[0].max_concurrent) > 0;

    return {
      peak_concurrent: parseInt(peakResult.rows[0]?.peak_concurrent || '0'),
      peak_time: peakResult.rows[0]?.peak_time,
      avg_concurrent: parseFloat(avgResult.rows[0]?.overall_avg || '0'),
      busiest_hour: hasMeaningfulData ? parseInt(hourlyResult.rows[0].hour_of_day) : null,
    };
  } catch (error) {
    logger.error('get_concurrent_stats_failed', { error: String(error) });
    return {
      peak_concurrent: 0,
      peak_time: null,
      avg_concurrent: 0,
      busiest_hour: null,
    };
  }
}

/**
 * Generate HTML email content for weekly report
 */
async function generateWeeklyReportHTML(): Promise<string> {
  try {
    const metrics = await getWeeklyMetrics();

    // Calculate date range for the report
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const dateRange = `${startDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      timeZone: EMAIL_TIME_ZONE,
    })} - ${endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: EMAIL_TIME_ZONE,
    })}`;

    // Get concurrent session stats
    const concurrentStats = await getConcurrentStats(startDate, endDate);

    // Format peak time
    const peakTimeFormatted = concurrentStats.peak_time
      ? new Date(concurrentStats.peak_time).toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
          timeZone: EMAIL_TIME_ZONE,
          timeZoneName: 'short',
        })
      : 'N/A';

    // Format busiest hour (already in Massachusetts local time)
    const busiestHour = concurrentStats.busiest_hour;
    const busiestHourFormatted = busiestHour !== null
      ? `${formatHour(busiestHour)} - ${formatHour((busiestHour + 1) % 24)} ET`
      : 'N/A';

    const { conversion_metrics, session_metrics, popular_faqs, intake_metrics } = metrics;

    // Usage insight shown under the concurrent usage figures
    let usageInsight = '';
    if (concurrentStats.peak_concurrent > 10) {
      usageInsight = callout(
        `Peak usage reached ${concurrentStats.peak_concurrent} concurrent visitors this week.`,
        { label: 'High engagement:' }
      );
    } else if (concurrentStats.peak_concurrent > 0 && busiestHour !== null) {
      usageInsight = callout(
        `Average concurrent usage was ${concurrentStats.avg_concurrent.toFixed(1)} visitors. Engagement is highest between ${busiestHourFormatted}.`,
        { label: 'Insight:' }
      );
    }

    const abandonment = intake_metrics.filter((i) => i.common_abandonment_step);
    const needsReview = metrics.phi_warnings_count > 5 || metrics.errors_count > 10;

    const content = [
      sectionHeading('Overview'),
      metricTiles([
        { label: 'Sessions', value: formatNumber(conversion_metrics.total_sessions) },
        { label: 'Handoff requests', value: formatNumber(conversion_metrics.handoff_requests) },
        { label: 'Conversion rate', value: formatPercent(conversion_metrics.conversion_rate) },
        { label: 'Avg session', value: formatDuration(session_metrics.avg_duration_seconds) },
      ]),

      sectionHeading('Concurrent usage'),
      metricTiles([
        {
          label: 'Peak concurrent',
          value: formatNumber(concurrentStats.peak_concurrent),
          note: concurrentStats.peak_time ? peakTimeFormatted : 'No data',
        },
        {
          label: 'Average concurrent',
          value: concurrentStats.avg_concurrent.toFixed(1),
          note: 'Across the week',
        },
        {
          label: 'Busiest hour',
          value: busiestHour !== null ? formatHour(busiestHour) : 'N/A',
          note: busiestHour !== null ? busiestHourFormatted : 'No data',
        },
      ]),
      usageInsight,

      sectionHeading('Requests by service'),
      conversion_metrics.by_service_type.length > 0
        ? dataTable(
            ['Service type', 'Requests', 'Share'],
            conversion_metrics.by_service_type.map((service) => [
              serviceTypeLabel(service.service_type),
              formatNumber(service.count),
              formatPercent(service.percentage),
            ])
          )
        : paragraph('No requests this period.'),

      sectionHeading('Most viewed FAQs'),
      popular_faqs.length > 0
        ? dataTable(
            ['Category', 'Question', 'Views'],
            popular_faqs.map((faq) => [
              ...faqLabels(faq.category, faq.question_id),
              formatNumber(faq.view_count),
            ]),
            ['left', 'left', 'right']
          )
        : paragraph('No FAQ data available for this period.'),

      sectionHeading('Intake flow performance'),
      intake_metrics.length > 0
        ? dataTable(
            ['Service type', 'Started', 'Completed', 'Completion', 'Avg time'],
            intake_metrics.map((intake) => [
              serviceTypeLabel(intake.service_type),
              formatNumber(intake.started_count),
              formatNumber(intake.completed_count),
              formatPercent(intake.completion_rate),
              formatDuration(intake.avg_duration_seconds),
            ])
          )
        : paragraph('No intake flow data available for this period.'),
      abandonment.length > 0
        ? callout(
            abandonment.map((i) => `${serviceTypeLabel(i.service_type)}: ${i.common_abandonment_step}`).join('; '),
            { label: 'Most common drop-off points:', tone: 'warning' }
          )
        : '',

      sectionHeading('Security and compliance'),
      detailRows([
        [
          'PHI warnings triggered',
          `${formatNumber(metrics.phi_warnings_count)} (${
            metrics.phi_warnings_count === 0 ? 'none detected' : 'review logs for details'
          })`,
        ],
        [
          'Errors',
          `${formatNumber(metrics.errors_count)} (${
            metrics.errors_count < 5 ? 'within normal range' : 'higher than normal'
          })`,
        ],
      ]),
      needsReview
        ? callout('Please review the system logs for PHI warnings and errors.', {
            label: 'Action required:',
            tone: 'warning',
          })
        : '',
    ].join('');

    const html = renderEmail({
      title: 'Chatbot Weekly Report',
      subtitle: dateRange,
      preheader: `${formatNumber(conversion_metrics.total_sessions)} sessions and ${formatNumber(
        conversion_metrics.handoff_requests
      )} handoff requests, ${dateRange}`,
      content,
      footerLines: [
        'This report is generated automatically by the Keka chatbot every week.',
        'Detailed analytics are available in the analytics_events table on Railway.',
      ],
    });

    return html;
  } catch (error) {
    logger.error('generate_weekly_report_failed', { error: String(error) });
    throw error;
  }
}

/**
 * Recipients for the weekly report: WEEKLY_REPORT_RECIPIENT as a
 * comma-separated list (trimmed and de-duplicated).
 */
export function getReportRecipients(): string[] {
  return parseEmailList(process.env.WEEKLY_REPORT_RECIPIENT);
}

/**
 * Send weekly report email
 */
export async function sendWeeklyReport(): Promise<boolean> {
  try {
    const recipients = getReportRecipients();

    if (recipients.length === 0) {
      logger.warn('weekly_report_no_recipient', {
        message: 'WEEKLY_REPORT_RECIPIENT environment variable not set',
      });
      return false;
    }

    // Check if AWS SES is configured
    if (!process.env.AWS_REGION || !process.env.SES_FROM_EMAIL) {
      logger.warn('weekly_report_ses_not_configured', {
        message: 'AWS SES not configured, skipping email',
      });
      return false;
    }

    logger.info('weekly_report_generation_started', {
      recipient_count: recipients.length,
      recipients: recipients.join(', '),
    });

    const htmlContent = await generateWeeklyReportHTML();

    // Send email via AWS SES
    const sesClient = getSESClient();
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: recipients,
      },
      Message: {
        Subject: {
          Data: `Keka Chatbot Weekly Report - ${new Date().toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: EMAIL_TIME_ZONE,
          })}`,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlContent,
            Charset: 'UTF-8',
          },
        },
      },
      Source: process.env.SES_FROM_EMAIL!,
    });

    await sesClient.send(command);

    logger.info('weekly_report_sent', {
      recipient_count: recipients.length,
      recipients: recipients.join(', '),
      timestamp: new Date().toISOString(),
    });

    return true;
  } catch (error) {
    logger.error('weekly_report_send_failed', {
      error: String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

/**
 * Generate report and return HTML (for testing/preview)
 */
export async function generateReportPreview(): Promise<string> {
  try {
    return await generateWeeklyReportHTML();
  } catch (error) {
    logger.error('generate_report_preview_failed', { error: String(error) });
    throw error;
  }
}
