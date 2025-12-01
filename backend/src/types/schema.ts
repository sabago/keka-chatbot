import { z } from 'zod';

// Bot response types
export const ButtonSchema = z.object({
  label: z.string().max(40),
  value: z.string().max(100),
});

export const LinkCardSchema = z.object({
  title: z.string().max(100),
  url: z.string().url(),
  description: z.string().max(200).optional(),
});

export const BotResponseSchema = z.object({
  text: z.string().max(600),
  buttons: z.array(ButtonSchema).max(12).optional(),
  links: z.array(LinkCardSchema).max(5).optional(),
  input_type: z.enum(['text', 'email', 'phone', 'textarea', 'date', 'none']).optional(),
  input_label: z.string().max(100).optional(),
  input_placeholder: z.string().max(100).optional(),
  next_state: z.enum([
    'awaiting_user_choice',
    'awaiting_contact',
    // Patient intake flow states
    'awaiting_dob',
    'awaiting_gender',
    'awaiting_address',
    'awaiting_emergency_contact',
    'awaiting_medical_info',
    'awaiting_assistive_devices',
    'awaiting_services',
    'awaiting_mobility',
    'awaiting_referral',
    'awaiting_insurance',
    'awaiting_care_for',
    'awaiting_setting',
    // Accreditation/Consulting flow states
    'awaiting_business_info',
    'awaiting_support_type',
    'awaiting_agency_status',
    'awaiting_start_date',
    'awaiting_notes_accreditation',
    // Staffing/Employment flow states
    'awaiting_discipline',
    'awaiting_license',
    'awaiting_experience',
    'awaiting_work_area',
    'awaiting_availability',
    'awaiting_transportation',
    'awaiting_consent',
    // Submit confirmation state (shared by all flows)
    'awaiting_submit_confirmation',
    'complete',
  ]),
  session_data: z.record(z.any()).optional(),
});

export type BotResponse = z.infer<typeof BotResponseSchema>;
export type Button = z.infer<typeof ButtonSchema>;
export type LinkCard = z.infer<typeof LinkCardSchema>;

// Chat request
export const ChatRequestSchema = z.object({
  message: z.string().max(500),
  session_id: z.string().uuid(),
  session_data: z.record(z.any()).optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

// Chat message schema (for transcript)
export const ChatMessageSchema = z.object({
  sender: z.enum(['user', 'bot']),
  text: z.string().max(1000),
  timestamp: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

// Handoff request
export const HandoffRequestSchema = z.object({
  // Service type discriminator
  service_type: z.enum(['patient_intake', 'accreditation_consulting', 'staffing_employment', 'general_inquiry']),

  // Common fields (all flows)
  contact_name: z.string().max(100).optional(),
  contact_type: z.enum(['phone', 'email']),
  contact_value: z.string().max(100),
  chat_transcript: z.array(ChatMessageSchema).max(100).optional(), // Full conversation history

  // Patient intake fields
  // Section 1: Client Information
  date_of_birth: z.string().max(50).optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  address_street: z.string().max(200).optional(),
  address_city: z.string().max(100).optional(),
  address_state: z.string().max(50).optional(),
  address_zip: z.string().max(20).optional(),

  // Section 2: Emergency Contact
  emergency_contact_name: z.string().max(100).optional(),
  emergency_contact_relationship: z.string().max(100).optional(),
  emergency_contact_phone: z.string().max(50).optional(),

  // Section 3: Medical Information
  primary_diagnosis: z.string().max(300).optional(),
  secondary_conditions: z.string().max(500).optional(),
  allergies: z.string().max(300).optional(),
  physician_name: z.string().max(100).optional(),
  physician_contact: z.string().max(100).optional(),
  assistive_devices: z.array(z.string()).optional(),

  // Section 4: Services Requested
  services_requested: z.array(z.string()).optional(),

  // Section 5: Functional/Mobility Status
  can_walk_independently: z.enum(['yes', 'no']).optional(),
  assistance_level: z.enum(['independent', 'minimal', 'moderate', 'maximal', 'unable']).optional(),
  fall_history: z.enum(['yes', 'no']).optional(),

  // Section 6: Referral Source
  referral_source: z.string().max(200).optional(),
  referral_agency: z.string().max(200).optional(),
  referral_contact: z.string().max(200).optional(),

  // Section 7: Insurance & Payment
  primary_insurance: z.string().max(100).optional(),
  insurance_member_id: z.string().max(100).optional(),
  secondary_insurance: z.string().max(100).optional(),
  responsible_party: z.string().max(100).optional(),

  // Legacy fields (backward compatibility)
  care_for: z.enum(['self', 'loved_one']).optional(),
  care_setting: z.enum(['in_home', 'adult_day_health', 'clinic_visit']).optional(),
  topic: z.string().max(200).optional(),
  context: z.string().max(500).optional(),

  // Accreditation/Consulting fields
  business_name: z.string().max(200).optional(),
  business_location: z.string().max(200).optional(),
  support_types: z.array(z.string()).optional(),
  agency_status: z.enum(['new_prelicensing', 'licensed_not_accredited', 'accredited_expanding']).optional(),
  preferred_start_date: z.string().max(100).optional(),
  notes_accreditation: z.string().max(500).optional(),

  // Staffing/Employment fields
  discipline: z.enum(['pt', 'pta', 'ot', 'cota', 'speech_therapist', 'rn', 'lpn', 'hha_cna']).optional(),
  license_number: z.string().max(100).optional(),
  license_state: z.string().max(50).optional(),
  years_experience: z.enum(['less_than_1', '1_to_3', '3_to_5', '5_to_10', '10_plus']).optional(),
  preferred_work_area: z.string().max(100).optional(),
  availability: z.enum(['full_time', 'part_time', 'per_diem']).optional(),
  has_transportation: z.boolean().optional(),
  consent_given: z.boolean().optional(),

  session_id: z.string().uuid(),
}).refine((data) => {
  // Validate contact_value based on contact_type
  if (data.contact_type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(data.contact_value);
  }
  if (data.contact_type === 'phone') {
    // Simple validation: Check for exactly 10 digits (US format)
    const digitsOnly = data.contact_value.replace(/\D/g, '');
    return digitsOnly.length === 10;
  }
  return true;
}, {
  message: 'Invalid contact value format',
  path: ['contact_value'],
}).refine((data) => {
  // Validate date_of_birth format and range if provided
  if (data.date_of_birth) {
    // Accept both M/D/YYYY and MM/DD/YYYY formats
    const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{4})$/;
    if (!dateRegex.test(data.date_of_birth)) {
      return false;
    }
    // Validate date is within reasonable range (1900-current year + 1)
    const [, , year] = data.date_of_birth.split('/').map(Number);
    const currentYear = new Date().getFullYear();
    return year >= 1900 && year <= currentYear + 1;
  }
  return true;
}, {
  message: 'Invalid date of birth format (must be M/D/YYYY or MM/DD/YYYY) or out of range (1900-2025)',
  path: ['date_of_birth'],
}).refine((data) => {
  // Validate emergency_contact_phone format if provided
  if (data.emergency_contact_phone) {
    // Simple validation: Check for exactly 10 digits (US format)
    const digitsOnly = data.emergency_contact_phone.replace(/\D/g, '');
    return digitsOnly.length === 10;
  }
  return true;
}, {
  message: 'Invalid emergency contact phone format',
  path: ['emergency_contact_phone'],
}).refine((data) => {
  // Validate preferred_start_date format if provided
  if (data.preferred_start_date) {
    // Accept both M/D/YYYY and MM/DD/YYYY formats
    const dateRegex = /^(0?[1-9]|1[0-2])\/(0?[1-9]|[12][0-9]|3[01])\/(\d{4})$/;
    return dateRegex.test(data.preferred_start_date);
  }
  return true;
}, {
  message: 'Invalid preferred start date format (must be M/D/YYYY or MM/DD/YYYY)',
  path: ['preferred_start_date'],
});

export type HandoffRequest = z.infer<typeof HandoffRequestSchema>;

// PHI keywords to detect and reject
export const PHI_KEYWORDS = [
  'ssn',
  'social security',
  'dob',
  'date of birth',
  'birthday',
  'mrn',
  'medical record',
  'diagnosis',
  'diagnosed',
  'prescription',
  'medication',
  'surgery',
  'blood pressure',
  'test result',
  'lab result',
  'insurance id',
  'policy number',
  'account number',
];

// Allowed domains for link cards
export const ALLOWED_DOMAINS = [
  'kekarehabservices.com',
  'www.kekarehabservices.com',
];

// Validate URL is allowed
export function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new globalThis.URL(url);
    return ALLOWED_DOMAINS.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

// Check for PHI in user input
export function containsPHI(text: string): boolean {
  const lower = text.toLowerCase();
  return PHI_KEYWORDS.some(keyword => lower.includes(keyword));
}
