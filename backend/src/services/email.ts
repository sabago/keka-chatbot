import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { logger } from '../utils/logger';

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
  serviceType: 'patient_intake' | 'accreditation_consulting' | 'staffing_employment';
  contactName?: string;
  contactType: 'email' | 'phone';
  contactValue: string;

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
  const serviceTypeMap: Record<string, string> = {
    'patient_intake': 'Patient / Client Intake',
    'accreditation_consulting': 'Accreditation & Consulting Support',
    'staffing_employment': 'Staffing & Employment',
  };
  const serviceTypeLabel = serviceTypeMap[notification.serviceType] || 'General Inquiry';

  let textBody = `New Contact Request from Keka Chatbot

Service Type: ${serviceTypeLabel}
${notification.contactName ? `Contact Name: ${notification.contactName}\n` : ''}Contact Method: ${notification.contactType}
${notification.contactType === 'email' ? 'Email' : 'Phone'}: ${notification.contactValue}
`;

  // Add comprehensive patient intake details
  if (notification.serviceType === 'patient_intake') {
    textBody += '\n=== CLIENT INFORMATION ===\n';
    if (notification.dateOfBirth) textBody += `Date of Birth: ${notification.dateOfBirth}\n`;
    if (notification.gender) {
      const genderMap: Record<string, string> = { male: 'Male', female: 'Female', other: 'Other', prefer_not_to_say: 'Prefer not to say' };
      textBody += `Gender: ${genderMap[notification.gender] || notification.gender}\n`;
    }
    if (notification.addressStreet || notification.addressCity) {
      textBody += `Address: ${notification.addressStreet || ''}, ${notification.addressCity || ''}, ${notification.addressState || ''} ${notification.addressZip || ''}\n`;
    }

    textBody += '\n=== EMERGENCY CONTACT ===\n';
    if (notification.emergencyContactName) textBody += `Name: ${notification.emergencyContactName}\n`;
    if (notification.emergencyContactRelationship) textBody += `Relationship: ${notification.emergencyContactRelationship}\n`;
    if (notification.emergencyContactPhone) textBody += `Phone: ${notification.emergencyContactPhone}\n`;

    textBody += '\n=== MEDICAL INFORMATION ===\n';
    if (notification.primaryDiagnosis) textBody += `Primary Diagnosis: ${notification.primaryDiagnosis}\n`;
    if (notification.secondaryConditions) textBody += `Secondary Conditions: ${notification.secondaryConditions}\n`;
    if (notification.allergies) textBody += `Allergies: ${notification.allergies}\n`;
    if (notification.physicianName) textBody += `Physician: ${notification.physicianName}\n`;
    if (notification.physicianContact) textBody += `Physician Contact: ${notification.physicianContact}\n`;
    if (notification.assistiveDevices && notification.assistiveDevices.length > 0) {
      textBody += `Assistive Devices: ${notification.assistiveDevices.join(', ')}\n`;
    }

    textBody += '\n=== SERVICES REQUESTED ===\n';
    if (notification.servicesRequested && notification.servicesRequested.length > 0) {
      textBody += `Services: ${notification.servicesRequested.join(', ')}\n`;
    }

    textBody += '\n=== MOBILITY ASSESSMENT ===\n';
    if (notification.canWalkIndependently) textBody += `Can Walk Independently: ${notification.canWalkIndependently}\n`;
    if (notification.assistanceLevel) textBody += `Assistance Level: ${notification.assistanceLevel}\n`;
    if (notification.fallHistory) textBody += `Fall History (6 months): ${notification.fallHistory}\n`;

    textBody += '\n=== REFERRAL SOURCE ===\n';
    if (notification.referralSource) textBody += `Referral Source: ${notification.referralSource}\n`;
    if (notification.referralAgency) textBody += `Referral Agency: ${notification.referralAgency}\n`;
    if (notification.referralContact) textBody += `Referral Contact: ${notification.referralContact}\n`;

    textBody += '\n=== INSURANCE & PAYMENT ===\n';
    if (notification.primaryInsurance) textBody += `Primary Insurance: ${notification.primaryInsurance}\n`;
    if (notification.insuranceMemberId) textBody += `Member ID: ${notification.insuranceMemberId}\n`;
    if (notification.secondaryInsurance) textBody += `Secondary Insurance: ${notification.secondaryInsurance}\n`;
    if (notification.responsibleParty) textBody += `Responsible Party: ${notification.responsibleParty}\n`;

    textBody += '\n=== REQUEST DETAILS ===\n';
    textBody += `Care For: ${notification.careFor === 'self' ? 'Themselves' : 'A Loved One'}\n`;
    const settingMap: Record<string, string> = { in_home: 'In-Home Care', adult_day_health: 'Adult Day Health', clinic_visit: 'Clinic Visit' };
    textBody += `Care Setting: ${notification.careSetting ? settingMap[notification.careSetting] : 'Not specified'}\n`;
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

  textBody += `\nSubmitted: ${new Date(notification.timestamp).toLocaleString()}`;
  textBody += `\nSession ID: ${notification.sessionId}`;
  textBody += '\n\nPlease respond to this request within 1-2 business days.';

  return textBody;
}

// Generate HTML email template
function generateEmailHTML(notification: ContactNotification): string {
  // Service type labels
  const serviceTypeMap: Record<string, string> = {
    'patient_intake': '🏥 Patient / Client Intake',
    'accreditation_consulting': '📊 Accreditation & Consulting Support',
    'staffing_employment': '👩🏾‍⚕️ Staffing & Employment',
  };
  const serviceTypeLabel = serviceTypeMap[notification.serviceType] || 'General Inquiry';

  // Generate service-specific content
  let specificFields = '';

  if (notification.serviceType === 'patient_intake') {
    const careForLabel = notification.careFor === 'self' ? 'Themselves' : 'A Loved One';
    const settingMap: Record<string, string> = {
      'in_home': 'In-Home Care',
      'adult_day_health': 'Adult Day Health',
      'clinic_visit': 'Clinic Visit',
    };
    const settingLabel = notification.careSetting ? settingMap[notification.careSetting] || 'Not specified' : 'Not specified';
    const genderMap: Record<string, string> = {
      'male': 'Male',
      'female': 'Female',
      'other': 'Other',
      'prefer_not_to_say': 'Prefer not to say',
    };

    specificFields = `
    <h3 style="color: #27A9E2; margin-top: 20px; margin-bottom: 15px;">📋 Client Information</h3>

    ${notification.dateOfBirth ? `
    <div class="info-row">
      <div class="label">Date of Birth</div>
      <div class="value">${notification.dateOfBirth}</div>
    </div>` : ''}

    ${notification.gender ? `
    <div class="info-row">
      <div class="label">Gender</div>
      <div class="value">${genderMap[notification.gender] || notification.gender}</div>
    </div>` : ''}

    ${notification.addressStreet || notification.addressCity ? `
    <div class="info-row">
      <div class="label">Address</div>
      <div class="value">
        ${notification.addressStreet || ''}<br>
        ${notification.addressCity || ''}, ${notification.addressState || ''} ${notification.addressZip || ''}
      </div>
    </div>` : ''}

    <h3 style="color: #27A9E2; margin-top: 20px; margin-bottom: 15px;">🚨 Emergency Contact</h3>

    ${notification.emergencyContactName ? `
    <div class="info-row">
      <div class="label">Emergency Contact</div>
      <div class="value">${notification.emergencyContactName} (${notification.emergencyContactRelationship || 'Relationship not specified'})</div>
    </div>` : ''}

    ${notification.emergencyContactPhone ? `
    <div class="info-row">
      <div class="label">Emergency Phone</div>
      <div class="value">${notification.emergencyContactPhone}</div>
    </div>` : ''}

    <h3 style="color: #27A9E2; margin-top: 20px; margin-bottom: 15px;">🏥 Medical Information</h3>

    ${notification.primaryDiagnosis ? `
    <div class="info-row">
      <div class="label">Primary Diagnosis</div>
      <div class="value">${notification.primaryDiagnosis}</div>
    </div>` : ''}

    ${notification.secondaryConditions ? `
    <div class="info-row">
      <div class="label">Secondary Conditions</div>
      <div class="value">${notification.secondaryConditions}</div>
    </div>` : ''}

    ${notification.allergies ? `
    <div class="info-row">
      <div class="label">Allergies</div>
      <div class="value">${notification.allergies}</div>
    </div>` : ''}

    ${notification.physicianName ? `
    <div class="info-row">
      <div class="label">Physician</div>
      <div class="value">${notification.physicianName}${notification.physicianContact ? ` (${notification.physicianContact})` : ''}</div>
    </div>` : ''}

    ${notification.assistiveDevices && notification.assistiveDevices.length > 0 ? `
    <div class="info-row">
      <div class="label">Assistive Devices</div>
      <div class="value">${notification.assistiveDevices.join(', ')}</div>
    </div>` : ''}

    <h3 style="color: #27A9E2; margin-top: 20px; margin-bottom: 15px;">💉 Services Requested</h3>

    ${notification.servicesRequested && notification.servicesRequested.length > 0 ? `
    <div class="info-row">
      <div class="label">Requested Services</div>
      <div class="value">${notification.servicesRequested.join(', ')}</div>
    </div>` : ''}

    <h3 style="color: #27A9E2; margin-top: 20px; margin-bottom: 15px;">🚶 Mobility Assessment</h3>

    ${notification.canWalkIndependently ? `
    <div class="info-row">
      <div class="label">Can Walk Independently</div>
      <div class="value">${notification.canWalkIndependently === 'yes' ? 'Yes' : 'No'}</div>
    </div>` : ''}

    ${notification.assistanceLevel ? `
    <div class="info-row">
      <div class="label">Assistance Level</div>
      <div class="value">${notification.assistanceLevel}</div>
    </div>` : ''}

    ${notification.fallHistory ? `
    <div class="info-row">
      <div class="label">Fall History (6 months)</div>
      <div class="value">${notification.fallHistory === 'yes' ? 'Yes' : 'No'}</div>
    </div>` : ''}

    <h3 style="color: #27A9E2; margin-top: 20px; margin-bottom: 15px;">📞 Referral Source</h3>

    ${notification.referralSource ? `
    <div class="info-row">
      <div class="label">Referral Source</div>
      <div class="value">${notification.referralSource}${notification.referralAgency ? ` - ${notification.referralAgency}` : ''}</div>
    </div>` : ''}

    ${notification.referralContact ? `
    <div class="info-row">
      <div class="label">Referral Contact</div>
      <div class="value">${notification.referralContact}</div>
    </div>` : ''}

    <h3 style="color: #27A9E2; margin-top: 20px; margin-bottom: 15px;">💳 Insurance & Payment</h3>

    ${notification.primaryInsurance ? `
    <div class="info-row">
      <div class="label">Primary Insurance</div>
      <div class="value">${notification.primaryInsurance}${notification.insuranceMemberId ? ` (ID: ${notification.insuranceMemberId})` : ''}</div>
    </div>` : ''}

    ${notification.secondaryInsurance ? `
    <div class="info-row">
      <div class="label">Secondary Insurance</div>
      <div class="value">${notification.secondaryInsurance}</div>
    </div>` : ''}

    ${notification.responsibleParty ? `
    <div class="info-row">
      <div class="label">Responsible Party</div>
      <div class="value">${notification.responsibleParty}</div>
    </div>` : ''}

    <h3 style="color: #27A9E2; margin-top: 20px; margin-bottom: 15px;">📝 Request Details</h3>

    <div class="info-row">
      <div class="label">Care Request For</div>
      <div class="value">${careForLabel}</div>
    </div>

    <div class="info-row">
      <div class="label">Preferred Care Setting</div>
      <div class="value">${settingLabel}</div>
    </div>
    `;
  } else if (notification.serviceType === 'accreditation_consulting') {
    const agencyStatusMap: Record<string, string> = {
      'new_prelicensing': 'New / Pre-licensing',
      'licensed_not_accredited': 'Licensed but not accredited',
      'accredited_expanding': 'Accredited and expanding',
    };
    const agencyStatusLabel = notification.agencyStatus ? agencyStatusMap[notification.agencyStatus] : 'Not specified';
    const supportTypesLabel = notification.supportTypes && notification.supportTypes.length > 0
      ? notification.supportTypes.join(', ')
      : 'Not specified';

    specificFields = `
    <div class="info-row">
      <div class="label">Business / Agency Name</div>
      <div class="value">${notification.businessName || 'Not provided'}</div>
    </div>

    <div class="info-row">
      <div class="label">Business Location</div>
      <div class="value">${notification.businessLocation || 'Not provided'}</div>
    </div>

    <div class="info-row">
      <div class="label">Support Types Needed</div>
      <div class="value">${supportTypesLabel}</div>
    </div>

    <div class="info-row">
      <div class="label">Agency Status</div>
      <div class="value">${agencyStatusLabel}</div>
    </div>

    <div class="info-row">
      <div class="label">Preferred Start Date</div>
      <div class="value">${notification.preferredStartDate || 'Not specified'}</div>
    </div>

    ${notification.notesAccreditation ? `
    <div class="info-row">
      <div class="label">Additional Notes</div>
      <div class="value">${notification.notesAccreditation}</div>
    </div>
    ` : ''}
    `;
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
    const disciplineLabel = notification.discipline ? disciplineMap[notification.discipline] : 'Not specified';

    const experienceMap: Record<string, string> = {
      'less_than_1': 'Less than 1 year',
      '1_to_3': '1-3 years',
      '3_to_5': '3-5 years',
      '5_to_10': '5-10 years',
      '10_plus': '10+ years',
    };
    const experienceLabel = notification.yearsExperience ? experienceMap[notification.yearsExperience] : 'Not specified';

    const availabilityMap: Record<string, string> = {
      'full_time': 'Full-time',
      'part_time': 'Part-time',
      'per_diem': 'Per Diem',
    };
    const availabilityLabel = notification.availability ? availabilityMap[notification.availability] : 'Not specified';

    specificFields = `
    <div class="info-row">
      <div class="label">Discipline / Role</div>
      <div class="value">${disciplineLabel}</div>
    </div>

    <div class="info-row">
      <div class="label">License Information</div>
      <div class="value">${notification.licenseNumber && notification.licenseState ? `${notification.licenseNumber} - ${notification.licenseState}` : 'Not provided'}</div>
    </div>

    <div class="info-row">
      <div class="label">Years of Experience</div>
      <div class="value">${experienceLabel}</div>
    </div>

    <div class="info-row">
      <div class="label">Preferred Work Area</div>
      <div class="value">${notification.preferredWorkArea || 'Not specified'}</div>
    </div>

    <div class="info-row">
      <div class="label">Availability</div>
      <div class="value">${availabilityLabel}</div>
    </div>

    <div class="info-row">
      <div class="label">Transportation Access</div>
      <div class="value">${notification.hasTransportation ? 'Yes' : 'No'}</div>
    </div>

    <div class="info-row">
      <div class="label">Consent Given</div>
      <div class="value">${notification.consentGiven ? 'Yes' : 'No'}</div>
    </div>
    `;
  }

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #27A9E2 0%, #2196F3 100%);
      color: white;
      padding: 30px;
      border-radius: 8px 8px 0 0;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      background: #ffffff;
      border: 1px solid #e0e0e0;
      border-top: none;
      border-radius: 0 0 8px 8px;
      padding: 30px;
    }
    .info-row {
      margin: 15px 0;
      padding: 12px;
      background: #f8f9fa;
      border-left: 4px solid #27A9E2;
      border-radius: 4px;
    }
    .label {
      font-weight: 600;
      color: #27A9E2;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .value {
      font-size: 16px;
      color: #333;
      word-break: break-word;
    }
    .priority {
      background: #fff3cd;
      border-left-color: #ffc107;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #e0e0e0;
      color: #666;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔔 New Contact Request from Keka Chatbot</h1>
  </div>

  <div class="content">
    <div class="priority">
      <strong>Action Required:</strong> A user has requested to be contacted through the chatbot.
    </div>

    <div class="info-row">
      <div class="label">Service Type</div>
      <div class="value"><strong>${serviceTypeLabel}</strong></div>
    </div>

    ${notification.contactName ? `
    <div class="info-row">
      <div class="label">Contact Name</div>
      <div class="value"><strong>${notification.contactName}</strong></div>
    </div>
    ` : ''}

    <div class="info-row">
      <div class="label">Contact Method</div>
      <div class="value">${notification.contactType === 'email' ? '📧 Email' : '📱 Phone'}</div>
    </div>

    <div class="info-row">
      <div class="label">${notification.contactType === 'email' ? 'Email Address' : 'Phone Number'}</div>
      <div class="value"><strong>${notification.contactValue}</strong></div>
    </div>

    ${specificFields}

    <div class="info-row">
      <div class="label">Submitted</div>
      <div class="value">${new Date(notification.timestamp).toLocaleString('en-US', {
        dateStyle: 'full',
        timeStyle: 'short'
      })}</div>
    </div>

    <div class="info-row">
      <div class="label">Session ID</div>
      <div class="value" style="font-size: 12px; font-family: monospace;">${notification.sessionId}</div>
    </div>
  </div>

  <div class="footer">
    <p>This notification was automatically generated by the Keka chatbot system.</p>
    <p>Please respond to this request within 1-2 business days.</p>
  </div>
</body>
</html>
  `.trim();
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
    // Service type labels
    const serviceTypeMap: Record<string, string> = {
      'patient_intake': 'Patient / Client Intake',
      'accreditation_consulting': 'Accreditation & Consulting Support',
      'staffing_employment': 'Staffing & Employment',
    };
    const serviceTypeLabel = serviceTypeMap[notification.serviceType] || 'General Inquiry';

    // Validate required environment variables
    const fromEmail = process.env.SES_FROM_EMAIL;
    const handoffEmail = process.env.HANDOFF_EMAIL;

    if (!fromEmail || !handoffEmail) {
      logger.error('email_config_missing', {
        has_from: !!fromEmail,
        has_handoff_email: !!handoffEmail,
        is_development: isDevelopment,
      });
      return false;
    }

    // Generate email content using helper functions
    const htmlBody = generateEmailHTML(notification);
    const textBody = generateEmailText(notification);
    const subject = `🔔 New ${serviceTypeLabel} Request - ${notification.contactType === 'email' ? 'Email' : 'Phone'}`;

    // Development mode: Just log the email
    if (isDevelopment) {
      logger.info('email_notification_dev', {
        service_type: notification.serviceType,
        contact_type: notification.contactType,
        handoff_email: handoffEmail,
      });

      console.log('\n' + '='.repeat(80));
      console.log('📧 EMAIL NOTIFICATION (DEVELOPMENT MODE - NOT ACTUALLY SENT)');
      console.log('='.repeat(80));
      console.log(`From: ${fromEmail}`);
      console.log(`To: ${handoffEmail}`);
      console.log(`Subject: ${subject}`);
      console.log('-'.repeat(80));
      console.log('TEXT VERSION:');
      console.log(textBody);
      console.log('-'.repeat(80));
      console.log('(HTML version also available but not shown)');
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
        ToAddresses: [handoffEmail],
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
      handoff_email: handoffEmail,
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

// Send admin notification email (always to admin email)
export async function sendAdminNotificationEmail(notification: ContactNotification): Promise<boolean> {
  // EARLY GUARD: Development mode - just log and return
  if (isDevelopment) {
    logger.info('admin_email_notification_dev_mode', {
      service_type: notification.serviceType,
      contact_type: notification.contactType,
      message: 'Development mode - admin email will be logged to console only',
    });
  }

  try {
    const adminEmail = 'scasey@ugabot.com';

    // Service type labels
    const serviceTypeMap: Record<string, string> = {
      'patient_intake': 'Patient / Client Intake',
      'accreditation_consulting': 'Accreditation & Consulting Support',
      'staffing_employment': 'Staffing & Employment',
    };
    const serviceTypeLabel = serviceTypeMap[notification.serviceType] || 'General Inquiry';

    // Validate required environment variables
    const fromEmail = process.env.SES_FROM_EMAIL;

    if (!fromEmail) {
      logger.error('admin_email_config_missing', {
        has_from: !!fromEmail,
        is_development: isDevelopment,
      });
      return false;
    }

    // Generate email content using helper functions
    const htmlBody = generateEmailHTML(notification);
    const textBody = generateEmailText(notification);
    const subject = `🔔 New ${serviceTypeLabel} Request - ${notification.contactType === 'email' ? 'Email' : 'Phone'}`;

    // Development mode: Just log the email
    if (isDevelopment) {
      logger.info('admin_email_notification_dev', {
        service_type: notification.serviceType,
        contact_type: notification.contactType,
        admin_email: adminEmail,
      });

      console.log('\n' + '='.repeat(80));
      console.log('📧 ADMIN EMAIL NOTIFICATION (DEVELOPMENT MODE - NOT ACTUALLY SENT)');
      console.log('='.repeat(80));
      console.log(`From: ${fromEmail}`);
      console.log(`To: ${adminEmail}`);
      console.log(`Subject: ${subject}`);
      console.log('-'.repeat(80));
      console.log('TEXT VERSION:');
      console.log(textBody);
      console.log('-'.repeat(80));
      console.log('(HTML version also available but not shown)');
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

    logger.info('admin_email_notification_sent', {
      message_id: response.MessageId,
      admin_email: adminEmail,
      contact_type: notification.contactType,
      service_type: notification.serviceType,
    });

    return true;
  } catch (error) {
    logger.error('admin_email_notification_failed', {
      error: String(error),
      error_name: error instanceof Error ? error.name : 'unknown',
      contact_type: notification.contactType,
    });
    return false;
  }
}
