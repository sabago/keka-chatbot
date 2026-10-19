import crypto from 'crypto';
import { HandoffRequest } from '../types/schema';
import { logger } from '../utils/logger';
import { sendContactNotification } from './email';
import { getPool } from '../db/init';
import fs from 'fs';
import path from 'path';

// Matches the development-mode check in services/email.ts
const nodeEnv = (process.env.NODE_ENV || '').toLowerCase().trim();
const isDevelopment = nodeEnv === 'development' || nodeEnv === 'dev' || nodeEnv === '';

export interface HandoffRecord extends HandoffRequest {
  timestamp: string;
  id: string;
}

// Save handoff request to file and send email notification
export async function saveHandoffRequest(request: HandoffRequest, ipHash: string): Promise<HandoffRecord> {
  const record: HandoffRecord = {
    ...request,
    timestamp: new Date().toISOString(),
    id: crypto.randomUUID(),
  };

  // Log event (no PII)
  logger.info('handoff_request_created', {
    session_id: request.session_id,
    ip_hash: ipHash,
    service_type: request.service_type,
    contact_type: request.contact_type,
    topic: request.topic,
  });

  // Save to database (primary storage)
  let dbSaved = false;
  let fileSaved = false;

  try {
    // Try to save to PostgreSQL if DATABASE_URL is set
    if (process.env.DATABASE_URL) {
      const pool = getPool();

      // Prepare form_data JSON from all additional fields
      // Patient intake stores no health information (HIPAA); only
      // care_for/care_setting, which have their own columns below.
      const formData = {
        // Accreditation/Consulting fields
        business_name: request.business_name,
        business_location: request.business_location,
        support_types: request.support_types,
        agency_status: request.agency_status,
        preferred_start_date: request.preferred_start_date,
        notes_accreditation: request.notes_accreditation,
        // Staffing/Employment fields
        discipline: request.discipline,
        license_number: request.license_number,
        license_state: request.license_state,
        years_experience: request.years_experience,
        preferred_work_area: request.preferred_work_area,
        availability: request.availability,
        has_transportation: request.has_transportation,
        consent_given: request.consent_given,
        topic: request.topic,
      };

      await pool.query(
        `INSERT INTO handoffs (
          id,
          service_type,
          contact_name,
          contact_type,
          contact_value,
          care_for,
          care_setting,
          form_data,
          session_id,
          ip_hash
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          record.id,
          request.service_type,
          request.contact_name,
          request.contact_type,
          request.contact_value,
          request.care_for,
          request.care_setting,
          JSON.stringify(formData),
          request.session_id,
          ipHash,
        ]
      );

      logger.info('handoff_saved_to_database', { id: record.id });
      dbSaved = true;
    } else {
      logger.warn('database_url_not_set', {
        message: 'DATABASE_URL not configured, using file storage fallback'
      });
    }
  } catch (error) {
    logger.error('handoff_database_save_failed', { error: String(error) });
  }

  // Fallback to file system if the database save failed or DATABASE_URL is not set.
  // Development only: handoff records contain personal contact details, so we
  // never write them to plaintext disk storage in production.
  // A production DB failure is escalated below instead.
  if (!dbSaved && isDevelopment) {
    try {
      const dataDir = path.join(__dirname, '../../data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      const handoffsPath = path.join(dataDir, 'handoffs.json');
      let handoffs: HandoffRecord[] = [];

      if (fs.existsSync(handoffsPath)) {
        const data = fs.readFileSync(handoffsPath, 'utf-8');
        handoffs = JSON.parse(data);
      }

      handoffs.push(record);
      fs.writeFileSync(handoffsPath, JSON.stringify(handoffs, null, 2));

      logger.info('handoff_saved_to_file', { id: record.id });
      fileSaved = true;
    } catch (error) {
      logger.error('handoff_file_save_failed', { error: String(error) });
    }
  } else if (!dbSaved) {
    // Production with no durable store: alert loudly. The record is not
    // persisted here, but the email notification below still delivers it.
    logger.error('handoff_not_persisted', {
      id: record.id,
      session_id: request.session_id,
      service_type: request.service_type,
      message: 'Database save failed in production; record not written to disk (personal data). Relying on email notification.',
    });
  }

  // Conditional notification routing based on contact type
  let notificationSent = false;

  const notificationData = {
    serviceType: request.service_type,
    contactName: request.contact_name,
    contactType: request.contact_type,
    contactValue: request.contact_value,

    // Patient intake (no health information is collected)
    careFor: request.care_for,
    careSetting: request.care_setting,

    // Accreditation/Consulting fields
    businessName: request.business_name,
    businessLocation: request.business_location,
    supportTypes: request.support_types,
    agencyStatus: request.agency_status,
    preferredStartDate: request.preferred_start_date,
    notesAccreditation: request.notes_accreditation,

    // Staffing/Employment fields
    discipline: request.discipline,
    licenseNumber: request.license_number,
    licenseState: request.license_state,
    yearsExperience: request.years_experience,
    preferredWorkArea: request.preferred_work_area,
    availability: request.availability,
    hasTransportation: request.has_transportation,
    consentGiven: request.consent_given,
  };

  try {
    // Always send email notification (regardless of contact_type preference)
    // The email will indicate whether user prefers email or phone contact
    notificationSent = await sendContactNotification({
      ...notificationData,
      sessionId: request.session_id,
      timestamp: record.timestamp,
    });
    logger.info('handoff_email_sent', {
      id: record.id,
      success: notificationSent,
      preferred_contact_method: request.contact_type,
    });
  } catch (error) {
    logger.error('handoff_notification_failed', {
      id: record.id,
      contact_type: request.contact_type,
      error: String(error),
    });
  }

  // Log overall result
  logger.info('handoff_notification_result', {
    id: record.id,
    db_saved: dbSaved,
    file_saved: fileSaved,
    notification_sent: notificationSent,
    preferred_contact_method: request.contact_type,
  });

  return record;
}

// Validate contact value based on type
export function validateContact(type: 'phone' | 'email', value: string): boolean {
  if (type === 'email') {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  }

  if (type === 'phone') {
    // Simple validation: Check for exactly 10 digits (US format)
    // Extract only digits and check the count
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length === 10;
  }

  return false;
}

// Validate date format - accepts both M/D/YYYY and MM/DD/YYYY
export function validateDate(dateString: string): boolean {
  // Check format using regex - accepts both single and double digit month/day
  // Month: 1-9 or 01-09 or 10-12
  // Day: 1-9 or 01-09 or 10-31
  const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{4})$/;

  if (!dateRegex.test(dateString)) {
    return false;
  }

  // Parse and validate as actual date
  const [month, day, year] = dateString.split('/').map(Number);
  const date = new Date(year, month - 1, day);

  // Check if the date is valid (handles leap years, invalid days per month)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}
