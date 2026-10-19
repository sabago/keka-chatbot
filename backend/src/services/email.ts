import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '../utils/logger';
import {
  EMAIL_TIME_ZONE,
  SERVICE_TYPE_LABELS,
  callout,
  detailRows,
  escapeHtml,
  parseEmailList,
  renderEmail,
  sectionHeading,
} from '../utils/emailFormat';

// Robust development mode check (trim whitespace and check multiple common values)
const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === '';

// Log environment mode on module load
logger.info('email_service_initialized', {
  node_env: process.env.NODE_ENV,
  is_development: isDevelopment,
});

// Initialize AWS SES client only in production
let sesClient: SESClient | null = null;
if (!isDevelopment) {
  try {
    sesClient = new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
    logger.info('ses_client_initialized', { region: process.env.AWS_REGION || 'us-east-1' });
  } catch (error) {
    logger.error('ses_client_init_failed', { error: String(error) });
  }
}

interface ContactNotification {
  serviceType: 'patient_intake' | 'accreditation_consulting' | 'staffing_employment' | 'general_inquiry';
  contactName?: string;
  contactType: 'email' | 'phone';
  contactValue: string;

  // Patient intake. No health information is collected or emailed (HIPAA):
  // staff gather clinical and insurance details by phone.
  careFor?: 'self' | 'loved_one';
  careSetting?: 'in_home' | 'adult_day_health' | 'clinic_visit';

  // Accreditation/Consulting fields
  businessName?: string;
  businessLocation?: string;
  supportTypes?: string[];
  agencyStatus?: 'new_prelicensing' | 'licensed_not_accredited' | 'accredited_expanding';
  preferredStartDate?: string;
  notesAccreditation?: string;

  // Staffing/Employment fields
  discipline?: 'pt' | 'pta' | 'ot' | 'cota' | 'speech_therapist' | 'rn' | 'lpn' | 'hha_cna';
  licenseNumber?: string;
  licenseState?: string;
  yearsExperience?: 'less_than_1' | '1_to_3' | '3_to_5' | '5_to_10' | '10_plus';
  preferredWorkArea?: string;
  availability?: 'full_time' | 'part_time' | 'per_diem';
  hasTransportation?: boolean;
  consentGiven?: boolean;

  flow?: string;
  sessionId: string;
  timestamp: string;
}

// Generate comprehensive text email body with all form data
function generateEmailText(notification: ContactNotification): string {
  const serviceTypeLabel = SERVICE_TYPE_LABELS[notification.serviceType] || 'General Inquiry';

  let textBody = `New Contact Request from Keka Chatbot

Service Type: ${serviceTypeLabel}
${notification.contactName ? `Contact Name: ${notification.contactName}\n` : ''}Contact Method: ${notification.contactType}
${notification.contactType === 'email' ? 'Email' : 'Phone'}: ${notification.contactValue}
`;

  if (notification.serviceType === 'patient_intake') {
    if (notification.careFor || notification.careSetting) {
      textBody += '\n=== REQUEST DETAILS ===\n';
      if (notification.careFor) {
        textBody += `Care For: ${notification.careFor === 'self' ? 'Themselves' : 'A Loved One'}\n`;
      }
      if (notification.careSetting) {
        const settingMap: Record<string, string> = { in_home: 'In-Home Care', adult_day_health: 'Adult Day Health', clinic_visit: 'Clinic Visit' };
        textBody += `Care Setting: ${settingMap[notification.careSetting]}\n`;
      }
    }
  } else if (notification.serviceType === 'accreditation_consulting') {
    textBody += '\n=== BUSINESS DETAILS ===\n';
    textBody += `Business Name: ${notification.businessName || 'Not provided'}\n`;
    textBody += `Location: ${notification.businessLocation || 'Not provided'}\n`;
    if (notification.supportTypes && notification.supportTypes.length > 0) {
      textBody += `Support Types: ${notification.supportTypes.join(', ')}\n`;
    }
    textBody += `Agency Status: ${notification.agencyStatus || 'Not provided'}\n`;
    textBody += `Preferred Start Date: ${notification.preferredStartDate || 'Not provided'}\n`;
    if (notification.notesAccreditation) {
      textBody += `Notes: ${notification.notesAccreditation}\n`;
    }
  } else if (notification.serviceType === 'staffing_employment') {
    textBody += '\n=== STAFFING DETAILS ===\n';
    textBody += `Discipline: ${notification.discipline || 'Not provided'}\n`;
    textBody += `License: ${notification.licenseNumber && notification.licenseState ? `${notification.licenseNumber} - ${notification.licenseState}` : 'Not provided'}\n`;
    textBody += `Experience: ${notification.yearsExperience || 'Not provided'}\n`;
    textBody += `Work Area: ${notification.preferredWorkArea || 'Not provided'}\n`;
    textBody += `Availability: ${notification.availability || 'Not provided'}\n`;
    textBody += `Transportation: ${notification.hasTransportation ? 'Yes' : 'No'}\n`;
  }

  textBody += `\nSubmitted: ${new Date(notification.timestamp).toLocaleString('en-US', { timeZone: EMAIL_TIME_ZONE, timeZoneName: 'short' })}`;
  textBody += `\nSession ID: ${notification.sessionId}`;
  textBody += '\n\nPlease respond to this request within 1-2 business days.';

  return textBody;
}

type DetailRow = [string, string];

// Section with label/value rows, omitted entirely when it has no rows
function detailSection(title: string, rows: Array<DetailRow | false | undefined | '' | null>): string {
  const filled = rows.filter((row): row is DetailRow => Array.isArray(row));
  if (filled.length === 0) return '';
  return sectionHeading(title) + detailRows(filled);
}

// Generate HTML email template
function generateEmailHTML(notification: ContactNotification): string {
  const serviceTypeLabel = SERVICE_TYPE_LABELS[notification.serviceType] || 'General Inquiry';

  // Generate service-specific content
  let specificFields = '';

  if (notification.serviceType === 'patient_intake') {
    const settingMap: Record<string, string> = {
      'in_home': 'In-Home Care',
      'adult_day_health': 'Adult Day Health',
      'clinic_visit': 'Clinic Visit',
    };
    const settingLabel = notification.careSetting ? settingMap[notification.careSetting] : undefined;

    specificFields = detailSection('Request details', [
      !!notification.careFor && ['Care requested for', notification.careFor === 'self' ? 'Themselves' : 'A loved one'],
      !!settingLabel && ['Preferred care setting', settingLabel!],
    ]);
  } else if (notification.serviceType === 'accreditation_consulting') {
    const agencyStatusMap: Record<string, string> = {
      'new_prelicensing': 'New / Pre-licensing',
      'licensed_not_accredited': 'Licensed but not accredited',
      'accredited_expanding': 'Accredited and expanding',
    };

    specificFields = detailSection('Business details', [
      ['Business / agency name', notification.businessName || 'Not provided'],
      ['Business location', notification.businessLocation || 'Not provided'],
      ['Support needed', notification.supportTypes?.length ? notification.supportTypes.join(', ') : 'Not specified'],
      ['Agency status', notification.agencyStatus ? agencyStatusMap[notification.agencyStatus] : 'Not specified'],
      ['Preferred start date', notification.preferredStartDate || 'Not specified'],
      !!notification.notesAccreditation && ['Additional notes', notification.notesAccreditation!],
    ]);
  } else if (notification.serviceType === 'staffing_employment') {
    const disciplineMap: Record<string, string> = {
      'pt': 'Physical Therapist (PT)',
      'pta': 'Physical Therapist Assistant (PTA)',
      'ot': 'Occupational Therapist (OT)',
      'cota': 'Certified Occupational Therapy Assistant (COTA)',
      'speech_therapist': 'Speech Therapist',
      'rn': 'Registered Nurse (RN)',
      'lpn': 'Licensed Practical Nurse (LPN)',
      'hha_cna': 'Home Health Aide (HHA) / Certified Nursing Assistant (CNA)',
    };
    const experienceMap: Record<string, string> = {
      'less_than_1': 'Less than 1 year',
      '1_to_3': '1-3 years',
      '3_to_5': '3-5 years',
      '5_to_10': '5-10 years',
      '10_plus': '10+ years',
    };
    const availabilityMap: Record<string, string> = {
      'full_time': 'Full-time',
      'part_time': 'Part-time',
      'per_diem': 'Per Diem',
    };

    specificFields = detailSection('Candidate details', [
      ['Discipline / role', notification.discipline ? disciplineMap[notification.discipline] : 'Not specified'],
      ['License', notification.licenseNumber && notification.licenseState ? `${notification.licenseNumber} - ${notification.licenseState}` : 'Not provided'],
      ['Years of experience', notification.yearsExperience ? experienceMap[notification.yearsExperience] : 'Not specified'],
      ['Preferred work area', notification.preferredWorkArea || 'Not specified'],
      ['Availability', notification.availability ? availabilityMap[notification.availability] : 'Not specified'],
      ['Transportation', notification.hasTransportation ? 'Yes' : 'No'],
      ['Consent given', notification.consentGiven ? 'Yes' : 'No'],
    ]);
  }

  const contactLink = notification.contactType === 'email'
    ? `<a href="mailto:${escapeHtml(notification.contactValue)}" style="color: #1D6FA5;">${escapeHtml(notification.contactValue)}</a>`
    : `<a href="tel:${escapeHtml(notification.contactValue.replace(/[^\d+]/g, ''))}" style="color: #1D6FA5;">${escapeHtml(notification.contactValue)}</a>`;

  const content = [
    callout('A website visitor asked to be contacted through the chatbot. Please respond within 1-2 business days.', {
      label: 'Action required:',
    }),
    sectionHeading('Contact'),
    detailRows([
      ['Service', serviceTypeLabel],
      ...(notification.contactName ? [['Name', notification.contactName] as DetailRow] : []),
      ['Preferred contact', notification.contactType === 'email' ? 'Email' : 'Phone'],
      [notification.contactType === 'email' ? 'Email address' : 'Phone number', { html: contactLink }],
    ]),
    specificFields,
    sectionHeading('Submission'),
    detailRows([
      ['Submitted', new Date(notification.timestamp).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short',
        timeZone: EMAIL_TIME_ZONE,
      })],
      ['Session ID', notification.sessionId],
    ]),
  ].join('');

  return renderEmail({
    title: 'New Contact Request',
    subtitle: serviceTypeLabel,
    preheader: `New ${serviceTypeLabel} request from the website chatbot`,
    content,
    footerLines: [
      'This notification was generated automatically by the Keka website chatbot.',
      'It may contain confidential information. Please handle it accordingly.',
    ],
  });
}

// Send email notification via AWS SES
export async function sendContactNotification(notification: ContactNotification): Promise<boolean> {
  // EARLY GUARD: Development mode - just log and return
  if (isDevelopment) {
    logger.info('email_notification_dev_mode', {
      service_type: notification.serviceType,
      contact_type: notification.contactType,
      message: 'Development mode - email will be logged to console only',
    });
  }

  try {
    const serviceTypeLabel = SERVICE_TYPE_LABELS[notification.serviceType] || 'General Inquiry';

    // Validate required environment variables
    const fromEmail = process.env.SES_FROM_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;
    const handoffEmailRaw = process.env.HANDOFF_EMAIL || '';

    if (!fromEmail || !adminEmail) {
      logger.error('email_config_missing', {
        has_from: !!fromEmail,
        has_admin_email: !!adminEmail,
        is_development: isDevelopment,
      });
      return false;
    }

    // HANDOFF_EMAIL is optional - a comma-separated list of BCC recipients.
    // De-duplicated, and ADMIN_EMAIL is skipped since it is already on To:
    const bccAddresses = parseEmailList(handoffEmailRaw)
      .filter(email => email.toLowerCase() !== adminEmail.trim().toLowerCase());

    // Generate email content using helper functions
    const htmlBody = generateEmailHTML(notification);
    const textBody = generateEmailText(notification);
    const subject = `New ${serviceTypeLabel} Request - ${notification.contactType === 'email' ? 'Email' : 'Phone'}`;

    // Development mode: Just log the email
    if (isDevelopment) {
      logger.info('email_notification_dev', {
        service_type: notification.serviceType,
        contact_type: notification.contactType,
        admin_email: adminEmail,
        bcc_count: bccAddresses.length,
      });

      console.log('\n' + '='.repeat(80));
      console.log('📧 EMAIL NOTIFICATION (DEVELOPMENT MODE - NOT ACTUALLY SENT)');
      console.log('='.repeat(80));
      console.log(`From: ${fromEmail}`);
      console.log(`To: ${adminEmail}`);
      console.log(`BCC: ${bccAddresses.join(', ')}`);
      console.log(`Subject: ${subject}`);
      console.log('-'.repeat(80));
      console.log('TEXT VERSION:');
      console.log(textBody);
      console.log('-'.repeat(80));
      console.log('HTML VERSION (FULL EMAIL TEMPLATE):');
      console.log(htmlBody);
      console.log('='.repeat(80) + '\n');

      return true;
    }

    // Production mode: Send via AWS SES
    if (!sesClient) {
      logger.error('ses_client_not_initialized', { error: 'SES client not available in production' });
      return false;
    }

    // Create SES send email command
    const command = new SendEmailCommand({
      Source: fromEmail,
      Destination: {
        ToAddresses: [adminEmail],
        ...(bccAddresses.length > 0 && { BccAddresses: bccAddresses }),
      },
      Message: {
        Subject: {
          Data: subject,
          Charset: 'UTF-8',
        },
        Body: {
          Html: {
            Data: htmlBody,
            Charset: 'UTF-8',
          },
          Text: {
            Data: textBody,
            Charset: 'UTF-8',
          },
        },
      },
    });

    // Send email
    const response = await sesClient.send(command);

    logger.info('email_notification_sent', {
      message_id: response.MessageId,
      admin_email: adminEmail,
      bcc_count: bccAddresses.length,
      contact_type: notification.contactType,
      service_type: notification.serviceType,
    });

    return true;
  } catch (error) {
    logger.error('email_notification_failed', {
      error: String(error),
      error_name: error instanceof Error ? error.name : 'unknown',
      contact_type: notification.contactType,
    });
    return false;
  }
}
