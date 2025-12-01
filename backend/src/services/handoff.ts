import crypto from 'crypto';
import { HandoffRequest } from '../types/schema';
import { logger } from '../utils/logger';
import { sendContactNotification } from './email';
import { getPool } from '../db/init';
import fs from 'fs';
import path from 'path';

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
      const formData = {
        // Patient intake fields
        date_of_birth: request.date_of_birth,
        gender: request.gender,
        address_street: request.address_street,
        address_city: request.address_city,
        address_state: request.address_state,
        address_zip: request.address_zip,
        emergency_contact_name: request.emergency_contact_name,
        emergency_contact_relationship: request.emergency_contact_relationship,
        emergency_contact_phone: request.emergency_contact_phone,
        primary_diagnosis: request.primary_diagnosis,
        secondary_conditions: request.secondary_conditions,
        allergies: request.allergies,
        physician_name: request.physician_name,
        physician_contact: request.physician_contact,
        assistive_devices: request.assistive_devices,
        services_requested: request.services_requested,
        can_walk_independently: request.can_walk_independently,
        assistance_level: request.assistance_level,
        fall_history: request.fall_history,
        referral_source: request.referral_source,
        referral_agency: request.referral_agency,
        referral_contact: request.referral_contact,
        primary_insurance: request.primary_insurance,
        insurance_member_id: request.insurance_member_id,
        secondary_insurance: request.secondary_insurance,
        responsible_party: request.responsible_party,
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

  // Fallback to file system if database save failed or DATABASE_URL not set
  if (!dbSaved) {
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
  }

  // Conditional notification routing based on contact type
  let notificationSent = false;

  const notificationData = {
    serviceType: request.service_type,
    contactName: request.contact_name,
    contactType: request.contact_type,
    contactValue: request.contact_value,
    chatTranscript: request.chat_transcript, // Include chat conversation

    // Patient intake fields - Section 1: Client Information
    dateOfBirth: request.date_of_birth,
    gender: request.gender,
    addressStreet: request.address_street,
    addressCity: request.address_city,
    addressState: request.address_state,
    addressZip: request.address_zip,

    // Patient intake - Section 2: Emergency Contact
    emergencyContactName: request.emergency_contact_name,
    emergencyContactRelationship: request.emergency_contact_relationship,
    emergencyContactPhone: request.emergency_contact_phone,

    // Patient intake - Section 3: Medical Information
    primaryDiagnosis: request.primary_diagnosis,
    secondaryConditions: request.secondary_conditions,
    allergies: request.allergies,
    physicianName: request.physician_name,
    physicianContact: request.physician_contact,
    assistiveDevices: request.assistive_devices,

    // Patient intake - Section 4: Services Requested
    servicesRequested: request.services_requested,

    // Patient intake - Section 5: Mobility
    canWalkIndependently: request.can_walk_independently,
    assistanceLevel: request.assistance_level,
    fallHistory: request.fall_history,

    // Patient intake - Section 6: Referral
    referralSource: request.referral_source,
    referralAgency: request.referral_agency,
    referralContact: request.referral_contact,

    // Patient intake - Section 7: Insurance
    primaryInsurance: request.primary_insurance,
    insuranceMemberId: request.insurance_member_id,
    secondaryInsurance: request.secondary_insurance,
    responsibleParty: request.responsible_party,

    // Patient intake - Legacy fields
    careFor: request.care_for,
    careSetting: request.care_setting,

    // Accreditation/Consulting fields
    businessName: request.business_name,
    businessLocation: request.business_location,
    supportTypes: request.support_types,
    agencyStatus: request.agency_status,
    startDate: request.preferred_start_date,
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

// Validate date is within reasonable range (1900-2025)
export function validateDateRange(dateString: string): boolean {
  if (!validateDate(dateString)) {
    return false;
  }

  const [, , year] = dateString.split('/').map(Number);
  const currentYear = new Date().getFullYear();

  return year >= 1900 && year <= currentYear + 1;
}
