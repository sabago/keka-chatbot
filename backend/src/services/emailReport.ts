import { getWeeklyMetrics } from './analytics';
import { logger } from '../utils/logger';
import { SendEmailCommand, SESClient } from '@aws-sdk/client-ses';
import { getPool } from '../db/init';

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
        EXTRACT(HOUR FROM hour) as hour_of_day,
        AVG(concurrent_sessions) as avg_concurrent,
        MAX(concurrent_sessions) as max_concurrent
      FROM concurrent_per_hour
      GROUP BY EXTRACT(HOUR FROM hour)
      ORDER BY max_concurrent DESC
      LIMIT 1;
    `, [startDate, endDate]);

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
    })} - ${endDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
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
        })
      : 'N/A';

    // Format busiest hour
    const busiestHour = concurrentStats.busiest_hour;
    const busiestHourFormatted = busiestHour !== null
      ? `${busiestHour}:00 - ${(busiestHour + 1) % 24}:00`
      : 'N/A';

    // Calculate previous week metrics for comparison (if needed)
    // For now, we'll just show current week metrics

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #0066cc;
      border-bottom: 3px solid #0066cc;
      padding-bottom: 10px;
    }
    h2 {
      color: #0066cc;
      margin-top: 30px;
      font-size: 18px;
    }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f5f5f5;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #0066cc;
    }
    .metric-value {
      font-size: 32px;
      font-weight: bold;
      color: #0066cc;
      margin: 5px 0;
    }
    .metric-label {
      font-size: 14px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .metric-change {
      font-size: 12px;
      color: #28a745;
      font-weight: bold;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th {
      background-color: #0066cc;
      color: white;
      font-weight: bold;
    }
    tr:hover {
      background-color: #f5f5f5;
    }
    .alert {
      background-color: #fff3cd;
      border-left: 4px solid #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .success {
      background-color: #d4edda;
      border-left: 4px solid #28a745;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 2px solid #ddd;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <h1>=� Keka Chatbot Weekly Report</h1>
  <p><strong>Period:</strong> ${dateRange}</p>

  <h2>=� OVERVIEW</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-label">Sessions</div>
      <div class="metric-value">${formatNumber(metrics.conversion_metrics.total_sessions)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Handoff Requests</div>
      <div class="metric-value">${formatNumber(metrics.conversion_metrics.handoff_requests)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Conversion Rate</div>
      <div class="metric-value">${formatPercent(metrics.conversion_metrics.conversion_rate)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Avg Session Duration</div>
      <div class="metric-value">${formatDuration(metrics.session_metrics.avg_duration_seconds)}</div>
    </div>
  </div>


  <h2>👥 CONCURRENT USAGE</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-label">Peak Concurrent Users</div>
      <div class="metric-value">${formatNumber(concurrentStats.peak_concurrent)}</div>
      <p style="font-size: 12px; color: #666; margin-top: 5px;">
        ${concurrentStats.peak_time ? `on ${peakTimeFormatted}` : 'No data'}
      </p>
    </div>
    <div class="metric-card">
      <div class="metric-label">Avg Concurrent Users</div>
      <div class="metric-value">${concurrentStats.avg_concurrent.toFixed(1)}</div>
      <p style="font-size: 12px; color: #666; margin-top: 5px;">
        Throughout the week
      </p>
    </div>
    <div class="metric-card">
      <div class="metric-label">Busiest Hour</div>
      <div class="metric-value">${busiestHour !== null ? `${busiestHour}:00` : 'N/A'}</div>
      <p style="font-size: 12px; color: #666; margin-top: 5px;">
        ${busiestHourFormatted}
      </p>
    </div>
  </div>
  ${
    concurrentStats.peak_concurrent > 10
      ? `
  <div class="success">
    <strong>📊 High Engagement:</strong> Peak concurrent usage of ${concurrentStats.peak_concurrent} users indicates strong chatbot adoption!
  </div>
  `
      : concurrentStats.peak_concurrent > 0 && busiestHour !== null
      ? `
  <div style="background-color: #e7f3ff; border-left: 4px solid #0066cc; padding: 15px; margin: 20px 0; border-radius: 4px;">
    <strong>💡 Insight:</strong> Average concurrent usage is ${concurrentStats.avg_concurrent.toFixed(1)} users. Consider promoting the chatbot during ${busiestHourFormatted} when engagement is highest.
  </div>
  `
      : ''
  }

  <h2><� SERVICE DISTRIBUTION</h2>
  <table>
    <thead>
      <tr>
        <th>Service Type</th>
        <th>Requests</th>
        <th>Percentage</th>
      </tr>
    </thead>
    <tbody>
      ${metrics.conversion_metrics.by_service_type
        .map(
          (service) => `
        <tr>
          <td>${service.service_type || 'Not specified'}</td>
          <td>${formatNumber(service.count)}</td>
          <td>${formatPercent(service.percentage)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>

  <h2>S TOP 5 MOST VIEWED FAQs</h2>
  ${
    metrics.popular_faqs.length > 0
      ? `
  <table>
    <thead>
      <tr>
        <th>Category</th>
        <th>Question ID</th>
        <th>Views</th>
        <th>Resolution Rate</th>
      </tr>
    </thead>
    <tbody>
      ${metrics.popular_faqs
        .map(
          (faq) => `
        <tr>
          <td>${faq.category}</td>
          <td>${faq.question_id}</td>
          <td>${formatNumber(faq.view_count)}</td>
          <td>${faq.resolution_rate ? formatPercent(faq.resolution_rate) : 'N/A'}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  `
      : '<p>No FAQ data available for this period.</p>'
  }

  <h2> INTAKE FLOW PERFORMANCE</h2>
  ${
    metrics.intake_metrics.length > 0
      ? `
  <table>
    <thead>
      <tr>
        <th>Service Type</th>
        <th>Started</th>
        <th>Completed</th>
        <th>Completion Rate</th>
        <th>Avg Duration</th>
      </tr>
    </thead>
    <tbody>
      ${metrics.intake_metrics
        .map(
          (intake) => `
        <tr>
          <td>${intake.service_type}</td>
          <td>${formatNumber(intake.started_count)}</td>
          <td>${formatNumber(intake.completed_count)}</td>
          <td>${formatPercent(intake.completion_rate)}</td>
          <td>${formatDuration(intake.avg_duration_seconds)}</td>
        </tr>
      `
        )
        .join('')}
    </tbody>
  </table>
  ${
    metrics.intake_metrics.some((i) => i.common_abandonment_step)
      ? `
  <div class="alert">
    <strong>� Common Drop-off Points:</strong>
    <ul>
      ${metrics.intake_metrics
        .filter((i) => i.common_abandonment_step)
        .map(
          (i) => `
        <li>${i.service_type}: ${i.common_abandonment_step}</li>
      `
        )
        .join('')}
    </ul>
  </div>
  `
      : ''
  }
  `
      : '<p>No intake flow data available for this period.</p>'
  }

  <h2>= SECURITY & COMPLIANCE</h2>
  <div class="metric-grid">
    <div class="metric-card">
      <div class="metric-label">PHI Warnings Triggered</div>
      <div class="metric-value">${formatNumber(metrics.phi_warnings_count)}</div>
      <p style="font-size: 12px; color: #666; margin-top: 5px;">
        ${
          metrics.phi_warnings_count === 0
            ? ' No PHI detected'
            : '� Review logs for details'
        }
      </p>
    </div>
    <div class="metric-card">
      <div class="metric-label">Errors</div>
      <div class="metric-value">${formatNumber(metrics.errors_count)}</div>
      <p style="font-size: 12px; color: #666; margin-top: 5px;">
        ${
          metrics.errors_count < 5
            ? ' Normal error rate'
            : '� Higher than normal'
        }
      </p>
    </div>
  </div>

  ${
    metrics.phi_warnings_count > 5 || metrics.errors_count > 10
      ? `
  <div class="alert">
    <strong>� Action Required:</strong> Review system logs for PHI warnings and errors.
  </div>
  `
      : ''
  }

  <div class="footer">
    <p>
      This report was automatically generated by the Keka Chatbot Analytics System.<br>
      For questions or issues, please contact your system administrator.
    </p>
    <p>
      <strong>View detailed analytics:</strong> Log into your Railway dashboard and query the analytics_events table.
    </p>
  </div>
</body>
</html>
    `;

    return html;
  } catch (error) {
    logger.error('generate_weekly_report_failed', { error: String(error) });
    throw error;
  }
}

/**
 * Send weekly report email
 */
export async function sendWeeklyReport(): Promise<boolean> {
  try {
    const recipient = process.env.WEEKLY_REPORT_RECIPIENT;

    if (!recipient) {
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
      recipient,
    });

    const htmlContent = await generateWeeklyReportHTML();

    // Send email via AWS SES
    const sesClient = getSESClient();
    const command = new SendEmailCommand({
      Destination: {
        ToAddresses: [recipient],
      },
      Message: {
        Subject: {
          Data: `=� Keka Chatbot Weekly Report - ${new Date().toLocaleDateString()}`,
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
      recipient,
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
