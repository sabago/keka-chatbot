import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { logger } from '../utils/logger.js';

// Robust development mode check (trim whitespace and check multiple common values)
const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === '';

// Log environment mode on module load
logger.info('sms_service_initialized', {
  node_env: process.env.NODE_ENV,
  is_development: isDevelopment,
});

// Initialize SNS client only in production
let snsClient: SNSClient | null = null;
if (!isDevelopment) {
  try {
    snsClient = new SNSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
    logger.info('sns_client_initialized', { region: process.env.AWS_REGION || 'us-east-1' });
  } catch (error) {
    logger.error('sns_client_init_failed', { error: String(error) });
  }
}

interface SMSNotification {
  serviceType: 'patient_intake' | 'accreditation_consulting' | 'staffing_employment' | 'general_inquiry';
  contactName?: string;
  contactType: 'phone' | 'email';
  contactValue: string;

  // Patient intake fields
  dateOfBirth?: string;
  gender?: string;
  addressStreet?: string;
  addressCity?: string;
  addressState?: string;
  addressZip?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  primaryDiagnosis?: string;
  assistiveDevices?: string[];
  servicesRequested?: string[];
  canWalkIndependently?: string;
  assistanceLevel?: string;
  fallHistory?: string;
  referralSource?: string;
  primaryInsurance?: string;
  careFor?: string;
  careSetting?: string;

  // Accreditation/Consulting fields
  businessName?: string;
  businessLocation?: string;
  supportTypes?: string[];
  agencyStatus?: string;
  startDate?: string;
  notesAccreditation?: string;

  // Staffing/Employment fields
  discipline?: string;
  license?: string;
  experience?: string;
  workArea?: string;
  customWorkArea?: string;
  availability?: string;
  transportation?: string;
  consent?: string;
}

/**
 * Format SMS message based on service type and collected data
 * SMS messages are limited to 1600 characters for concatenated messages
 */
function formatSMSMessage(notification: SMSNotification): string {
  const serviceTypeLabels = {
    patient_intake: 'Patient/Client Intake',
    accreditation_consulting: 'Accreditation & Consulting',
    staffing_employment: 'Staffing & Employment',
    general_inquiry: 'General Contact',
  };

  let message = `🚨 NEW ${serviceTypeLabels[notification.serviceType].toUpperCase()} REQUEST\n\n`;

  // Contact information (always included)
  message += `👤 Contact: ${notification.contactName || 'Not provided'}\n`;
  message += `📧 ${notification.contactType === 'email' ? 'Email' : 'Phone'}: ${notification.contactValue}\n\n`;

  // Service-specific details
  if (notification.serviceType === 'patient_intake') {
    message += `🏥 PATIENT DETAILS:\n`;

    // Client Information
    if (notification.dateOfBirth) {
      message += `• DOB: ${notification.dateOfBirth}\n`;
    }
    if (notification.gender) {
      const genderMap: Record<string, string> = {
        male: 'Male',
        female: 'Female',
        other: 'Other',
        prefer_not_to_say: 'Prefer not to say',
      };
      message += `• Gender: ${genderMap[notification.gender] || notification.gender}\n`;
    }

    // Address (condensed format)
    if (notification.addressCity && notification.addressState) {
      message += `• Location: ${notification.addressCity}, ${notification.addressState}`;
      if (notification.addressZip) {
        message += ` ${notification.addressZip}`;
      }
      message += `\n`;
    }

    // Emergency Contact
    if (notification.emergencyContactName) {
      message += `• Emergency: ${notification.emergencyContactName}`;
      if (notification.emergencyContactPhone) {
        message += ` (${notification.emergencyContactPhone})`;
      }
      message += `\n`;
    }

    // Medical Information
    if (notification.primaryDiagnosis) {
      // Truncate diagnosis if too long for SMS
      const maxDiagnosisLength = 100;
      const diagnosis = notification.primaryDiagnosis.length > maxDiagnosisLength
        ? notification.primaryDiagnosis.substring(0, maxDiagnosisLength) + '...'
        : notification.primaryDiagnosis;
      message += `• Diagnosis: ${diagnosis}\n`;
    }

    // Assistive Devices
    if (notification.assistiveDevices && notification.assistiveDevices.length > 0) {
      const devices = notification.assistiveDevices.filter(d => d !== 'none');
      if (devices.length > 0) {
        message += `• Assistive devices: ${devices.join(', ')}\n`;
      }
    }

    // Services Requested
    if (notification.servicesRequested && notification.servicesRequested.length > 0) {
      const servicesMap: Record<string, string> = {
        pt: 'PT',
        ot: 'OT',
        speech: 'Speech',
        nursing: 'Nursing',
        hha: 'HHA',
        transportation: 'Transport',
        equipment: 'Equipment',
      };
      const services = notification.servicesRequested.map(s => servicesMap[s] || s);
      message += `• Services: ${services.join(', ')}\n`;
    }

    // Mobility Assessment
    if (notification.canWalkIndependently) {
      message += `• Walks independently: ${notification.canWalkIndependently}\n`;
    }
    if (notification.assistanceLevel) {
      const levelMap: Record<string, string> = {
        independent: 'Independent',
        minimal: 'Minimal assist',
        moderate: 'Moderate assist',
        maximal: 'Maximal assist',
        unable: 'Unable',
      };
      message += `• Assistance level: ${levelMap[notification.assistanceLevel] || notification.assistanceLevel}\n`;
    }
    if (notification.fallHistory) {
      message += `• Fall history: ${notification.fallHistory}\n`;
    }

    // Referral Source
    if (notification.referralSource) {
      message += `• Referral: ${notification.referralSource}\n`;
    }

    // Insurance
    if (notification.primaryInsurance) {
      message += `• Insurance: ${notification.primaryInsurance}\n`;
    }

    // Legacy fields (for backward compatibility)
    if (notification.careFor) {
      message += `• Care for: ${notification.careFor === 'self' ? 'Self' : 'Loved one'}\n`;
    }
    if (notification.careSetting) {
      const settingMap: Record<string, string> = {
        in_home: 'In-home',
        adult_day_health: 'Adult day health',
        clinic_visit: 'Clinic visit',
      };
      message += `• Care setting: ${settingMap[notification.careSetting] || notification.careSetting}\n`;
    }
  } else if (notification.serviceType === 'accreditation_consulting') {
    message += `📊 BUSINESS DETAILS:\n`;
    message += `• Business: ${notification.businessName || 'Not provided'}\n`;
    message += `• Location: ${notification.businessLocation || 'Not provided'}\n`;

    if (notification.supportTypes && notification.supportTypes.length > 0) {
      message += `• Support needed: ${notification.supportTypes.join(', ')}\n`;
    }

    message += `• Agency status: ${notification.agencyStatus || 'Not provided'}\n`;
    message += `• Start date: ${notification.startDate || 'Not provided'}\n`;

    if (notification.notesAccreditation) {
      // Truncate notes if too long
      const maxNotesLength = 200;
      const notes = notification.notesAccreditation.length > maxNotesLength
        ? notification.notesAccreditation.substring(0, maxNotesLength) + '...'
        : notification.notesAccreditation;
      message += `• Notes: ${notes}\n`;
    }
  } else if (notification.serviceType === 'staffing_employment') {
    message += `👩‍⚕️ STAFFING DETAILS:\n`;
    message += `• Discipline: ${notification.discipline || 'Not provided'}\n`;
    message += `• License: ${notification.license || 'Not provided'}\n`;
    message += `• Experience: ${notification.experience || 'Not provided'}\n`;

    const workArea = notification.customWorkArea || notification.workArea || 'Not provided';
    message += `• Work area: ${workArea}\n`;
    message += `• Availability: ${notification.availability || 'Not provided'}\n`;
    message += `• Transportation: ${notification.transportation || 'Not provided'}\n`;
    message += `• Background consent: ${notification.consent || 'Not provided'}\n`;
  }

  message += `\n⏰ Submitted: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`;

  return message;
}

/**
 * Send SMS notification via AWS SNS
 * In development mode, logs the message instead of sending
 * Gracefully skips if HANDOFF_PHONE is not configured
 */
export async function sendSMSNotification(notification: SMSNotification): Promise<void> {
  // EARLY GUARD: Development mode - just log and return
  if (isDevelopment) {
    logger.info('sms_notification_dev_mode', {
      service_type: notification.serviceType,
      contact_type: notification.contactType,
      message: 'Development mode - SMS will be logged to console only',
    });
  }

  const message = formatSMSMessage(notification);
  const phoneNumber = process.env.HANDOFF_PHONE;

  if (!phoneNumber) {
    logger.warn('sms_config_missing', {
      error: 'HANDOFF_PHONE not configured, skipping SMS notification',
      is_development: isDevelopment,
    });
    return; // Gracefully skip SMS if not configured
  }

  // Development mode: Just log the SMS
  if (isDevelopment) {
    logger.info('sms_notification_dev', {
      service_type: notification.serviceType,
      contact_type: notification.contactType,
      phone_number: phoneNumber,
      message_length: message.length,
    });

    console.log('\n' + '='.repeat(80));
    console.log('📱 SMS NOTIFICATION (DEVELOPMENT MODE - NOT ACTUALLY SENT)');
    console.log('='.repeat(80));
    console.log(`To: ${phoneNumber}`);
    console.log('-'.repeat(80));
    console.log(message);
    console.log('='.repeat(80) + '\n');

    return;
  }

  // Production mode: Send via AWS SNS
  if (!snsClient) {
    logger.error('sns_client_not_initialized', { error: 'SNS client not available in production' });
    throw new Error('SNS client not initialized');
  }

  try {
    const command = new PublishCommand({
      PhoneNumber: phoneNumber,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional', // Ensures delivery priority
        },
      },
    });

    const response = await snsClient.send(command);

    logger.info('sms_notification_sent', {
      service_type: notification.serviceType,
      contact_type: notification.contactType,
      phone_number: phoneNumber,
      message_id: response.MessageId,
      message_length: message.length,
    });
  } catch (error) {
    logger.error('sms_send_failed', {
      error: String(error),
      service_type: notification.serviceType,
      phone_number: phoneNumber,
    });
    throw error;
  }
}

/**
 * Send admin SMS notification (always to admin phone)
 * In development mode, logs the message instead of sending
 * Gracefully skips if SMS is not configured
 */
export async function sendAdminSMSNotification(notification: SMSNotification): Promise<void> {
  // EARLY GUARD: Development mode - just log and return
  if (isDevelopment) {
    logger.info('admin_sms_notification_dev_mode', {
      service_type: notification.serviceType,
      contact_type: notification.contactType,
      message: 'Development mode - admin SMS will be logged to console only',
    });
  }

  const message = formatSMSMessage(notification);
  const adminPhone = '6179530639';

  // Development mode: Just log the SMS
  if (isDevelopment) {
    logger.info('admin_sms_notification_dev', {
      service_type: notification.serviceType,
      contact_type: notification.contactType,
      admin_phone: adminPhone,
      message_length: message.length,
    });

    console.log('\n' + '='.repeat(80));
    console.log('📱 ADMIN SMS NOTIFICATION (DEVELOPMENT MODE - NOT ACTUALLY SENT)');
    console.log('='.repeat(80));
    console.log(`To: ${adminPhone}`);
    console.log('-'.repeat(80));
    console.log(message);
    console.log('='.repeat(80) + '\n');

    return;
  }

  // Production mode: Send via AWS SNS
  if (!snsClient) {
    logger.warn('sns_client_not_initialized', { error: 'SNS client not available, skipping SMS notification' });
    return; // Gracefully skip if SNS not configured
  }

  try {
    const command = new PublishCommand({
      PhoneNumber: adminPhone,
      Message: message,
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional', // Ensures delivery priority
        },
      },
    });

    const response = await snsClient.send(command);

    logger.info('admin_sms_notification_sent', {
      service_type: notification.serviceType,
      contact_type: notification.contactType,
      admin_phone: adminPhone,
      message_id: response.MessageId,
      message_length: message.length,
    });
  } catch (error) {
    logger.error('admin_sms_send_failed', {
      error: String(error),
      service_type: notification.serviceType,
      admin_phone: adminPhone,
    });
    throw error;
  }
}
