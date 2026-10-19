/**
 * Shared helpers for outgoing emails (handoff notifications and weekly report).
 *
 * Layout uses tables and inline styles because Outlook and Gmail ignore most
 * CSS in <style> blocks (no grid/flex, limited class support).
 */

// Palette: neutral text with the Keka blue as an accent
const COLORS = {
  accent: '#27A9E2',
  heading: '#0F2B46',
  text: '#1F2937',
  muted: '#6B7280',
  border: '#E5E7EB',
  panel: '#F9FAFB',
  page: '#F3F4F6',
};

const FONT = "Arial, Helvetica, sans-serif";

// Staff are in Massachusetts; the server (Railway) runs in UTC
export const EMAIL_TIME_ZONE = 'America/New_York';

export const SERVICE_TYPE_LABELS: Record<string, string> = {
  'patient_intake': 'Patient / Client Intake',
  'accreditation_consulting': 'Accreditation & Consulting Support',
  'staffing_employment': 'Staffing & Employment',
  'general_inquiry': 'General Contact Request',
};

/** Human-readable label for a service type id (falls back to the id) */
export function serviceTypeLabel(type: string | undefined): string {
  if (!type) return 'Not specified';
  return SERVICE_TYPE_LABELS[type] || type;
}

/**
 * Escape a value for safe interpolation into HTML.
 * User-supplied text (chat messages, names, notes) must never be inserted raw,
 * or a visitor could inject links or markup into staff emails.
 */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parse a comma-separated list of email addresses from an env var.
 * Entries are trimmed, blanks dropped, and duplicates removed
 * case-insensitively so a repeated address does not receive two copies.
 */
export function parseEmailList(raw: string | undefined): string[] {
  const seen = new Set<string>();

  return (raw || '')
    .split(',')
    .map(email => email.trim())
    .filter(Boolean)
    .filter(email => {
      const key = email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** Section heading with a thin rule underneath */
export function sectionHeading(title: string): string {
  return `
    <tr><td style="padding: 28px 0 8px 0; font-family: ${FONT}; font-size: 13px; font-weight: bold; letter-spacing: 0.8px; text-transform: uppercase; color: ${COLORS.heading}; border-bottom: 1px solid ${COLORS.border};">
      ${escapeHtml(title)}
    </td></tr>`;
}

/**
 * Label/value rows. Values are escaped unless passed as { html } for
 * trusted, pre-built markup.
 */
export function detailRows(rows: Array<[string, string | { html: string }]>): string {
  const body = rows
    .map(([label, value]) => {
      const rendered = typeof value === 'string' ? escapeHtml(value) : value.html;
      return `
        <tr>
          <td valign="top" width="38%" style="padding: 9px 12px 9px 0; font-family: ${FONT}; font-size: 13px; color: ${COLORS.muted}; border-bottom: 1px solid ${COLORS.border};">${escapeHtml(label)}</td>
          <td valign="top" style="padding: 9px 0; font-family: ${FONT}; font-size: 14px; color: ${COLORS.text}; border-bottom: 1px solid ${COLORS.border}; word-break: break-word;">${rendered}</td>
        </tr>`;
    })
    .join('');

  return `
    <tr><td style="padding: 4px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
    </td></tr>`;
}

/**
 * Data table with a header row. Cell values are escaped.
 * Columns default to: first left-aligned, the rest right-aligned (numbers).
 */
export function dataTable(headers: string[], rows: string[][], align?: Array<'left' | 'right'>): string {
  const alignOf = (i: number) => align?.[i] ?? (i === 0 ? 'left' : 'right');
  const head = headers
    .map((h, i) => `<th align="${alignOf(i)}" style="padding: 9px 8px; font-family: ${FONT}; font-size: 12px; font-weight: bold; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 0.5px; background: ${COLORS.panel}; border-bottom: 1px solid ${COLORS.border};">${escapeHtml(h)}</th>`)
    .join('');
  const body = rows
    .map(row => `<tr>${row
      .map((cell, i) => `<td align="${alignOf(i)}" style="padding: 9px 8px; font-family: ${FONT}; font-size: 14px; color: ${COLORS.text}; border-bottom: 1px solid ${COLORS.border};">${escapeHtml(cell)}</td>`)
      .join('')}</tr>`)
    .join('');

  return `
    <tr><td style="padding: 8px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;">
        <thead><tr>${head}</tr></thead>
        <tbody>${body}</tbody>
      </table>
    </td></tr>`;
}

/** Row of headline numbers (2-4 tiles) */
export function metricTiles(tiles: Array<{ label: string; value: string; note?: string }>): string {
  const width = Math.floor(100 / tiles.length);
  const cells = tiles
    .map(t => `
      <td valign="top" width="${width}%" style="padding: 14px 12px; background: ${COLORS.panel}; border: 1px solid ${COLORS.border};">
        <div style="font-family: ${FONT}; font-size: 11px; color: ${COLORS.muted}; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(t.label)}</div>
        <div style="font-family: ${FONT}; font-size: 24px; font-weight: bold; color: ${COLORS.heading}; padding-top: 4px;">${escapeHtml(t.value)}</div>
        ${t.note ? `<div style="font-family: ${FONT}; font-size: 12px; color: ${COLORS.muted}; padding-top: 2px;">${escapeHtml(t.note)}</div>` : ''}
      </td>`)
    .join('');

  return `
    <tr><td style="padding: 12px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: collapse;"><tr>${cells}</tr></table>
    </td></tr>`;
}

/** Highlighted note. `text` is escaped; `label` is shown in bold before it. */
export function callout(text: string, options: { label?: string; tone?: 'info' | 'warning' } = {}): string {
  const border = options.tone === 'warning' ? '#B45309' : COLORS.accent;
  const background = options.tone === 'warning' ? '#FFFBEB' : '#F0F9FF';
  return `
    <tr><td style="padding: 16px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="padding: 12px 14px; background: ${background}; border-left: 3px solid ${border}; font-family: ${FONT}; font-size: 14px; line-height: 1.5; color: ${COLORS.text};">
          ${options.label ? `<strong>${escapeHtml(options.label)}</strong> ` : ''}${escapeHtml(text)}
        </td>
      </tr></table>
    </td></tr>`;
}

/** Plain paragraph inside the content column */
export function paragraph(text: string): string {
  return `
    <tr><td style="padding: 12px 0 0 0; font-family: ${FONT}; font-size: 14px; line-height: 1.5; color: ${COLORS.text};">${escapeHtml(text)}</td></tr>`;
}

/**
 * Wrap content rows (from the helpers above) in the branded email shell.
 * `title`/`subtitle`/`footerLines` are escaped.
 */
export function renderEmail(options: {
  title: string;
  subtitle?: string;
  preheader?: string;
  content: string;
  footerLines: string[];
}): string {
  const footer = options.footerLines
    .map(line => `<div style="padding-top: 4px;">${escapeHtml(line)}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(options.title)}</title>
</head>
<body style="margin: 0; padding: 0; background: ${COLORS.page};">
  ${options.preheader ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${escapeHtml(options.preheader)}</div>` : ''}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${COLORS.page};">
    <tr><td align="center" style="padding: 24px 12px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 640px; background: #FFFFFF; border: 1px solid ${COLORS.border}; border-top: 4px solid ${COLORS.accent};">
        <tr><td style="padding: 24px 32px 20px 32px; border-bottom: 1px solid ${COLORS.border};">
          <div style="font-family: ${FONT}; font-size: 12px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; color: ${COLORS.accent};">Keka Rehab Services</div>
          <div style="font-family: ${FONT}; font-size: 22px; font-weight: bold; color: ${COLORS.heading}; padding-top: 6px;">${escapeHtml(options.title)}</div>
          ${options.subtitle ? `<div style="font-family: ${FONT}; font-size: 14px; color: ${COLORS.muted}; padding-top: 4px;">${escapeHtml(options.subtitle)}</div>` : ''}
        </td></tr>
        <tr><td style="padding: 4px 32px 28px 32px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            ${options.content}
          </table>
        </td></tr>
        <tr><td style="padding: 16px 32px 20px 32px; background: ${COLORS.panel}; border-top: 1px solid ${COLORS.border}; font-family: ${FONT}; font-size: 12px; line-height: 1.5; color: ${COLORS.muted};">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
