export interface Button {
  label: string;
  value: string;
}

export interface LinkCard {
  title: string;
  url: string;
  description?: string;
}

export interface BotResponse {
  text: string;
  buttons?: Button[];
  links?: LinkCard[];
  input_type?: 'text' | 'email' | 'phone' | 'textarea' | 'none';
  input_label?: string;
  input_placeholder?: string;
  next_state:
    | 'awaiting_user_choice'
    | 'awaiting_contact'
    | 'awaiting_care_for'
    | 'awaiting_setting'
    // Accreditation/Consulting flow states
    | 'awaiting_business_info'
    | 'awaiting_support_type'
    | 'awaiting_agency_status'
    | 'awaiting_start_date'
    | 'awaiting_notes_accreditation'
    // Staffing/Employment flow states
    | 'awaiting_discipline'
    | 'awaiting_license'
    | 'awaiting_experience'
    | 'awaiting_work_area'
    | 'awaiting_availability'
    | 'awaiting_transportation'
    | 'awaiting_consent'
    | 'complete';
  session_data?: Record<string, any>;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot';
  text: string;
  buttons?: Button[];
  links?: LinkCard[];
  input_type?: 'text' | 'email' | 'phone' | 'textarea' | 'none';
  input_label?: string;
  input_placeholder?: string;
  timestamp: Date;
  session_data?: Record<string, any>;
}

export interface HandoffRequest {
  // Service type discriminator
  service_type: 'patient_intake' | 'accreditation_consulting' | 'staffing_employment';

  // Common fields (all flows)
  contact_name?: string;
  contact_type: 'phone' | 'email';
  contact_value: string;

  // Patient intake fields (existing flow)
  care_for?: 'self' | 'loved_one';
  care_setting?: 'in_home' | 'adult_day_health' | 'clinic_visit';
  topic?: string;
  context?: string;

  // Accreditation/Consulting fields
  business_name?: string;
  business_location?: string;
  support_types?: string[];
  agency_status?: 'new_prelicensing' | 'licensed_not_accredited' | 'accredited_expanding';
  preferred_start_date?: string;
  notes_accreditation?: string;

  // Staffing/Employment fields
  discipline?: 'pt' | 'pta' | 'ot' | 'cota' | 'speech_therapist' | 'rn' | 'lpn' | 'hha_cna';
  license_number?: string;
  license_state?: string;
  years_experience?: 'less_than_1' | '1_to_3' | '3_to_5' | '5_to_10' | '10_plus';
  preferred_work_area?: string;
  availability?: 'full_time' | 'part_time' | 'per_diem';
  has_transportation?: boolean;
  consent_given?: boolean;

  session_id: string;
}
