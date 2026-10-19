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

interface ChatMessage {
  sender: 'user' | 'bot';
  text: string;
  timestamp: string;
}

interface ContactNotification {
  serviceType: 'patient_intake' | 'accreditation_consulting' | 'staffing_employment' | 'general_inquiry';
  contactName?: string;
  contactType: 'email' | 'phone';
  contactValue: string;
  chatTranscript?: ChatMessage[]; // Full conversation history

  // Patient intake fields - Section 1: Client Information
  dateOfBirth?: string;
  gender?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;

  // Patient intake - Section 2: Emergency Contact
  emergencyContactName?: string;
  emergencyContactRelationship?: string;
  emergencyContactPhone?: string;

  // Patient intake - Section 3: Medical Information
  primaryDiagnosis?: string;
  secondaryConditions?: string;
  allergies?: string;
  physicianName?: string;
  physicianContact?: string;
  assistiveDevices?: string[];

  // Patient intake - Section 4: Services Requested
  servicesRequested?: string[];

  // Patient intake - Section 5: Mobility
  canWalkIndependently?: string;
  assistanceLevel?: string;
  fallHistory?: string;

  // Patient intake - Section 6: Referral
  referralSource?: string;
  referralAgency?: string;
  referralContact?: string;

  // Patient intake - Section 7: Insurance
  primaryInsurance?: string;
  insuranceMemberId?: string;
  secondaryInsurance?: string;
  responsibleParty?: string;

  // Patient intake - Legacy fields
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

  // Add chat transcript if available
  if (notification.chatTranscript && notification.chatTranscript.length > 0) {
    textBody += '\n=== CHAT CONVERSATION ===\n';
    notification.chatTranscript.forEach((msg) => {
      const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: EMAIL_TIME_ZONE,
      });
      textBody += `[${time}] ${msg.sender === 'user' ? 'User' : 'Bot'}: ${msg.text}\n`;
    });
  }

  // Add comprehensive patient intake details (only if data exists)
  if (notification.serviceType === 'patient_intake') {
    // Only add sections that have actual data
    if (notification.dateOfBirth || notification.gender || notification.addressStreet || notification.addressCity) {
      textBody += '\n=== CLIENT INFORMATION ===\n';
      if (notification.dateOfBirth) textBody += `Date of Birth: ${notification.dateOfBirth}\n`;
      if (notification.gender) {
        const genderMap: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say' };
        textBody += `Gender: ${genderMap[notification.gender] || notification.gender}\n`;
      }
      if (notification.addressStreet || notification.addressCity) {
        textBody += `Address: ${notification.addressStreet || ''}, ${notification.addressCity || ''}, ${notification.addressState || ''} ${notification.addressZip || ''}\n`;
      }
    }

    if (notification.emergencyContactName || notification.emergencyContactPhone) {
      textBody += '\n=== EMERGENCY CONTACT ===\n';
      if (notification.emergencyContactName) textBody += `Name: ${notification.emergencyContactName}\n`;
      if (notification.emergencyContactRelationship) textBody += `Relationship: ${notification.emergencyContactRelationship}\n`;
      if (notification.emergencyContactPhone) textBody += `Phone: ${notification.emergencyContactPhone}\n`;
    }

    if (notification.primaryDiagnosis || notification.secondaryConditions || notification.allergies || notification.physicianName || (notification.assistiveDevices && notification.assistiveDevices.length > 0)) {
      textBody += '\n=== MEDICAL INFORMATION ===\n';
      if (notification.primaryDiagnosis) textBody += `Primary Diagnosis: ${notification.primaryDiagnosis}\n`;
      if (notification.secondaryConditions) textBody += `Secondary Conditions: ${notification.secondaryConditions}\n`;
      if (notification.allergies) textBody += `Allergies: ${notification.allergies}\n`;
      if (notification.physicianName) textBody += `Physician: ${notification.physicianName}\n`;
      if (notification.physicianContact) textBody += `Physician Contact: ${notification.physicianContact}\n`;
      if (notification.assistiveDevices && notification.assistiveDevices.length > 0) {
        textBody += `Assistive Devices: ${notification.assistiveDevices.join(', ')}\n`;
      }
    }

    if (notification.servicesRequested && notification.servicesRequested.length > 0) {
      textBody += '\n=== SERVICES REQUESTED ===\n';
      textBody += `Services: ${notification.servicesRequested.join(', ')}\n`;
    }

    if (notification.canWalkIndependently || notification.assistanceLevel || notification.fallHistory) {
      textBody += '\n=== MOBILITY ASSESSMENT ===\n';
      if (notification.canWalkIndependently) textBody += `Can Walk Independently: ${notification.canWalkIndependently}\n`;
      if (notification.assistanceLevel) textBody += `Assistance Level: ${notification.assistanceLevel}\n`;
      if (notification.fallHistory) textBody += `Fall History (6 months): ${notification.fallHistory}\n`;
    }

    if (notification.referralSource || notification.referralContact) {
      textBody += '\n=== REFERRAL SOURCE ===\n';
      if (notification.referralSource) textBody += `Referral Source: ${notification.referralSource}\n`;
      if (notification.referralAgency) textBody += `Referral Agency: ${notification.referralAgency}\n`;
      if (notification.referralContact) textBody += `Referral Contact: ${notification.referralContact}\n`;
    }

    if (notification.primaryInsurance || notification.secondaryInsurance || notification.responsibleParty) {
      textBody += '\n=== INSURANCE & PAYMENT ===\n';
      if (notification.primaryInsurance) textBody += `Primary Insurance: ${notification.primaryInsurance}\n`;
      if (notification.insuranceMemberId) textBody += `Member ID: ${notification.insuranceMemberId}\n`;
      if (notification.secondaryInsurance) textBody += `Secondary Insurance: ${notification.secondaryInsurance}\n`;
      if (notification.responsibleParty) textBody += `Responsible Party: ${notification.responsibleParty}\n`;
    }

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

// Helper function to generate chat transcript HTML
function generateChatTranscriptHTML(transcript?: ChatMessage[]): string {
  if (!transcript || transcript.length === 0) {
    return '';
  }

  const messageRows = transcript
    .map((msg) => {
      const isUser = msg.sender === 'user';
      const time = new Date(msg.timestamp).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: EMAIL_TIME_ZONE,
      });

      return `
        <tr><td style="padding: 8px 12px; border-left: 3px solid ${isUser ? '#27A9E2' : '#D1D5DB'}; background: ${isUser ? '#F0F9FF' : '#F9FAFB'};">
          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 12px; color: #6B7280;">
            <strong style="color: #0F2B46;">${isUser ? 'Visitor' : 'Keka chatbot'}</strong> &middot; ${escapeHtml(time)}
          </div>
          <div style="font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #1F2937; padding-top: 2px; white-space: pre-wrap;">${escapeHtml(msg.text)}</div>
        </td></tr>
        <tr><td style="height: 6px; line-height: 6px; font-size: 6px;">&nbsp;</td></tr>`;
    })
    .join('');

  return `
    ${sectionHeading('Chat conversation')}
    <tr><td style="padding: 10px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${messageRows}</table>
    </td></tr>`;
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
    const genderMap: Record<string, string> = {
      'male': 'Male',
      'female': 'Female',
      'other': 'Other',
      'prefer_not_to_say': 'Prefer not to say',
    };
    const settingMap: Record<string, string> = {
      'in_home': 'In-Home Care',
      'adult_day_health': 'Adult Day Health',
      'clinic_visit': 'Clinic Visit',
    };
    const hasAddress = notification.addressStreet || notification.addressCity;
    const settingLabel = notification.careSetting ? settingMap[notification.careSetting] : undefined;

    specificFields = [
      detailSection('Client information', [
        !!notification.dateOfBirth && ['Date of birth', notification.dateOfBirth!],
        !!notification.gender && ['Gender', genderMap[notification.gender!] || notification.gender!],
        !!hasAddress && ['Address', `${notification.addressStreet || ''}, ${notification.addressCity || ''}, ${notification.addressState || ''} ${notification.addressZip || ''}`],
      ]),
      detailSection('Emergency contact', [
        !!notification.emergencyContactName && ['Name', `${notification.emergencyContactName}${notification.emergencyContactRelationship ? ` (${notification.emergencyContactRelationship})` : ''}`],
        !!notification.emergencyContactPhone && ['Phone', notification.emergencyContactPhone!],
      ]),
      detailSection('Medical information', [
        !!notification.primaryDiagnosis && ['Primary diagnosis', notification.primaryDiagnosis!],
        !!notification.secondaryConditions && ['Secondary conditions', notification.secondaryConditions!],
        !!notification.allergies && ['Allergies', notification.allergies!],
        !!notification.physicianName && ['Physician', `${notification.physicianName}${notification.physicianContact ? ` (${notification.physicianContact})` : ''}`],
        !!notification.assistiveDevices?.length && ['Assistive devices', notification.assistiveDevices!.join(', ')],
      ]),
      detailSection('Services requested', [
        !!notification.servicesRequested?.length && ['Requested services', notification.servicesRequested!.join(', ')],
      ]),
      detailSection('Mobility', [
        !!notification.canWalkIndependently && ['Can walk independently', notification.canWalkIndependently === 'yes' ? 'Yes' : 'No'],
        !!notification.assistanceLevel && ['Assistance level', notification.assistanceLevel!],
        !!notification.fallHistory && ['Fall history (6 months)', notification.fallHistory === 'yes' ? 'Yes' : 'No'],
      ]),
      detailSection('Referral', [
        !!notification.referralSource && ['Referral source', `${notification.referralSource}${notification.referralAgency ? ` - ${notification.referralAgency}` : ''}`],
        !!notification.referralContact && ['Referral contact', notification.referralContact!],
      ]),
      detailSection('Insurance and payment', [
        !!notification.primaryInsurance && ['Primary insurance', `${notification.primaryInsurance}${notification.insuranceMemberId ? ` (ID: ${notification.insuranceMemberId})` : ''}`],
        !!notification.secondaryInsurance && ['Secondary insurance', notification.secondaryInsurance!],
        !!notification.responsibleParty && ['Responsible party', notification.responsibleParty!],
      ]),
      detailSection('Request details', [
        !!notification.careFor && ['Care requested for', notification.careFor === 'self' ? 'Themselves' : 'A loved one'],
        !!settingLabel && ['Preferred care setting', settingLabel!],
      ]),
    ].join('');
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
    generateChatTranscriptHTML(notification.chatTranscript),
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
