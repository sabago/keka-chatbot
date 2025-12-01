import crypto from 'crypto';
import { BotResponse, ChatRequest, containsPHI, Button } from '../types/schema';
import { getHomeScreen, getCategoryButtons, getFAQAnswer, getResolutionButtons } from './faq';
import { generateRetrievalResponse } from './retrieve';
import { saveHandoffRequest, validateContact, validateDate, validateDateRange } from './handoff';
import { sendAdminNotificationEmail } from './email';
import { logger } from '../utils/logger';
import { pushState, popState, canGoBack, clearHistory } from '../utils/stateHistory';

// Helper to add navigation buttons to any response
function addNavigationButtons(buttons: Button[] = [], sessionData: any = {}): Button[] {
  const backButton: Button[] = canGoBack(sessionData)
    ? [{ label: 'Back', value: 'back' }]
    : [];

  return [
    ...buttons,
    ...backButton,
    { label: 'Back to Menu', value: 'home' },
    { label: 'Speak to a Human', value: 'contact_me' },
  ];
}

// Helper to add bot response to chat transcript and return updated response
function addBotResponseToTranscript(response: BotResponse, chatTranscript: any[]): BotResponse {
  // Add bot's response to transcript
  const updatedTranscript = [
    ...chatTranscript,
    {
      sender: 'bot' as const,
      text: response.text,
      timestamp: new Date().toISOString(),
    },
  ];

  // Include transcript in session_data
  return {
    ...response,
    session_data: {
      ...response.session_data,
      chat_transcript: updatedTranscript,
    },
  };
}

// Restore state response when user navigates back
// This function reconstructs the appropriate question/UI for a given state
function restoreStateResponse(sessionData: any): BotResponse {
  const state = sessionData.state || 'awaiting_user_choice';

  // Common patterns for different flows
  const serviceType = sessionData.service_type;

  switch (state) {
    case 'awaiting_user_choice':
      return getHomeScreen();

    // === CONTACT COLLECTION FLOW ===
    case 'awaiting_contact':
      if (sessionData.awaiting_name) {
        return {
          text: 'Let\'s get started with your care request. What\'s your name?',
          input_type: 'text',
          input_label: 'Your Full Name',
          input_placeholder: 'John Smith',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_contact',
          session_data: sessionData,
        };
      } else if (!sessionData.contact_type) {
        return {
          text: 'Thank you! How would you like us to reach you?',
          buttons: addNavigationButtons([
            { label: 'Email', value: 'email' },
            { label: 'Phone', value: 'phone' },
          ], sessionData),
          next_state: 'awaiting_contact',
          session_data: sessionData,
        };
      } else {
        return {
          text: sessionData.contact_type === 'email'
            ? 'Please enter your email address:'
            : 'Please enter your phone number:',
          input_type: sessionData.contact_type,
          input_label: sessionData.contact_type === 'email' ? 'Your Email Address' : 'Your Phone Number',
          input_placeholder: sessionData.contact_type === 'email' ? 'you@example.com' : '(555) 123-4567',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_contact',
          session_data: sessionData,
        };
      }

    // === PATIENT INTAKE FLOW ===
    case 'awaiting_dob':
      return {
        text: 'Thank you! Now let\'s collect some basic information. What is the patient\'s date of birth?',
        input_type: 'date',
        input_label: 'Date of Birth',
        input_placeholder: 'MM/DD/YYYY',
        buttons: addNavigationButtons([], sessionData),
        next_state: 'awaiting_dob',
        session_data: sessionData,
      };

    case 'awaiting_gender':
      return {
        text: 'What is the patient\'s gender?',
        buttons: addNavigationButtons([
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' },
          { label: 'Other', value: 'other' },
          { label: 'Prefer not to say', value: 'prefer_not_to_say' },
        ], sessionData),
        next_state: 'awaiting_gender',
        session_data: sessionData,
      };

    case 'awaiting_address':
      if (!sessionData.address_street) {
        return {
          text: 'What is the patient\'s street address?',
          input_type: 'text',
          input_label: 'Street Address',
          input_placeholder: '123 Main St, Apt 4B',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_address',
          session_data: sessionData,
        };
      } else if (!sessionData.address_city) {
        return {
          text: 'What city?',
          input_type: 'text',
          input_label: 'City',
          input_placeholder: 'Boston',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_address',
          session_data: sessionData,
        };
      } else if (!sessionData.address_state) {
        return {
          text: 'What state?',
          input_type: 'text',
          input_label: 'State',
          input_placeholder: 'MA',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_address',
          session_data: sessionData,
        };
      } else {
        return {
          text: 'What is the ZIP code?',
          input_type: 'text',
          input_label: 'ZIP Code',
          input_placeholder: '02101',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_address',
          session_data: sessionData,
        };
      }

    case 'awaiting_emergency_contact':
      if (!sessionData.emergency_contact_name) {
        return {
          text: 'Who is the emergency contact person?',
          input_type: 'text',
          input_label: 'Emergency Contact Name',
          input_placeholder: 'Jane Doe',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_emergency_contact',
          session_data: sessionData,
        };
      } else if (!sessionData.emergency_contact_relationship) {
        return {
          text: 'What is their relationship to the patient?',
          input_type: 'text',
          input_label: 'Relationship',
          input_placeholder: 'Daughter',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_emergency_contact',
          session_data: sessionData,
        };
      } else {
        return {
          text: 'What is their phone number?',
          input_type: 'phone',
          input_label: 'Emergency Contact Phone',
          input_placeholder: '(555) 123-4567',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_emergency_contact',
          session_data: sessionData,
        };
      }

    case 'awaiting_medical_info':
      if (!sessionData.primary_diagnosis) {
        return {
          text: 'What is the primary diagnosis or reason for care?',
          input_type: 'text',
          input_label: 'Primary Diagnosis',
          input_placeholder: 'e.g., stroke recovery, fall recovery, etc.',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_medical_info',
          session_data: sessionData,
        };
      } else if (!sessionData.secondary_conditions) {
        return {
          text: 'Are there any secondary conditions or co-morbidities?',
          input_type: 'text',
          input_label: 'Secondary Conditions',
          input_placeholder: 'e.g., diabetes, hypertension, or type "none"',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_medical_info',
          session_data: sessionData,
        };
      } else if (!sessionData.allergies) {
        return {
          text: 'Does the patient have any allergies?',
          input_type: 'text',
          input_label: 'Allergies',
          input_placeholder: 'e.g., penicillin, latex, or type "none"',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_medical_info',
          session_data: sessionData,
        };
      } else if (!sessionData.physician_name) {
        return {
          text: 'Who is the primary care physician?',
          input_type: 'text',
          input_label: 'Physician Name',
          input_placeholder: 'Dr. Smith',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_medical_info',
          session_data: sessionData,
        };
      } else {
        return {
          text: 'What is the physician\'s contact information?',
          input_type: 'text',
          input_label: 'Physician Contact',
          input_placeholder: 'Phone or fax number',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_medical_info',
          session_data: sessionData,
        };
      }

    case 'awaiting_assistive_devices':
      return {
        text: 'Does the patient use any assistive devices? (Select all that apply)',
        buttons: addNavigationButtons([
          { label: 'Walker', value: 'walker' },
          { label: 'Cane', value: 'cane' },
          { label: 'Wheelchair', value: 'wheelchair' },
          { label: 'Oxygen', value: 'oxygen' },
          { label: 'Hearing Aid', value: 'hearing_aid' },
          { label: 'None', value: 'none' },
          { label: 'Continue →', value: 'continue' },
        ], sessionData),
        next_state: 'awaiting_assistive_devices',
        session_data: sessionData,
      };

    case 'awaiting_services':
      return {
        text: 'What services are you looking for? (Select all that apply)',
        buttons: addNavigationButtons([
          { label: 'Physical Therapy', value: 'pt' },
          { label: 'Occupational Therapy', value: 'ot' },
          { label: 'Speech Therapy', value: 'speech' },
          { label: 'Nursing', value: 'nursing' },
          { label: 'Home Health Aide', value: 'hha' },
          { label: 'Transportation', value: 'transportation' },
          { label: 'Medical Equipment', value: 'equipment' },
          { label: 'Continue →', value: 'continue' },
        ], sessionData),
        next_state: 'awaiting_services',
        session_data: sessionData,
      };

    case 'awaiting_mobility':
      if (!sessionData.can_walk_independently) {
        return {
          text: 'Can the patient walk independently?',
          buttons: addNavigationButtons([
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ], sessionData),
          next_state: 'awaiting_mobility',
          session_data: sessionData,
        };
      } else if (!sessionData.assistance_level) {
        return {
          text: 'What level of assistance is needed for mobility?',
          buttons: addNavigationButtons([
            { label: 'Independent', value: 'independent' },
            { label: 'Minimal assistance', value: 'minimal' },
            { label: 'Moderate assistance', value: 'moderate' },
            { label: 'Maximal assistance', value: 'maximal' },
            { label: 'Unable to walk', value: 'unable' },
          ], sessionData),
          next_state: 'awaiting_mobility',
          session_data: sessionData,
        };
      } else {
        return {
          text: 'Has the patient had any falls in the past 6 months?',
          buttons: addNavigationButtons([
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ], sessionData),
          next_state: 'awaiting_mobility',
          session_data: sessionData,
        };
      }

    case 'awaiting_referral':
      if (!sessionData.referral_source) {
        return {
          text: 'How did you hear about Keka?',
          buttons: addNavigationButtons([
            { label: 'Hospital', value: 'hospital' },
            { label: 'Physician', value: 'physician' },
            { label: 'Social Worker', value: 'social_worker' },
            { label: 'Friend/Family', value: 'friend_family' },
            { label: 'Online Search', value: 'online' },
            { label: 'Other', value: 'other' },
          ], sessionData),
          next_state: 'awaiting_referral',
          session_data: sessionData,
        };
      } else if (sessionData.referral_source !== 'online' && sessionData.referral_source !== 'friend_family' && !sessionData.referral_agency) {
        return {
          text: 'What is the name of the referring agency or organization?',
          input_type: 'text',
          input_label: 'Agency Name',
          input_placeholder: 'e.g., Boston Medical Center',
          buttons: addNavigationButtons([
            { label: 'Skip', value: 'skip' },
          ], sessionData),
          next_state: 'awaiting_referral',
          session_data: sessionData,
        };
      } else {
        return {
          text: 'Contact information for the referral source (optional):',
          input_type: 'text',
          input_label: 'Referral Contact',
          input_placeholder: 'Name and phone number',
          buttons: addNavigationButtons([
            { label: 'Skip', value: 'skip' },
          ], sessionData),
          next_state: 'awaiting_referral',
          session_data: sessionData,
        };
      }

    case 'awaiting_insurance':
      if (!sessionData.primary_insurance) {
        return {
          text: 'What is the primary insurance provider?',
          buttons: addNavigationButtons([
            { label: 'Medicare', value: 'medicare' },
            { label: 'MassHealth (Medicaid)', value: 'masshealth' },
            { label: 'Blue Cross Blue Shield', value: 'bcbs' },
            { label: 'Harvard Pilgrim', value: 'harvard_pilgrim' },
            { label: 'Tufts Health Plan', value: 'tufts' },
            { label: 'Other', value: 'other' },
            { label: 'Private Pay', value: 'private_pay' },
          ], sessionData),
          next_state: 'awaiting_insurance',
          session_data: sessionData,
        };
      } else if (!sessionData.insurance_member_id && sessionData.primary_insurance !== 'private_pay') {
        return {
          text: 'What is the insurance member ID?',
          input_type: 'text',
          input_label: 'Member ID',
          input_placeholder: 'As shown on insurance card',
          buttons: addNavigationButtons([
            { label: 'Skip', value: 'skip' },
          ], sessionData),
          next_state: 'awaiting_insurance',
          session_data: sessionData,
        };
      } else if (!sessionData.secondary_insurance) {
        return {
          text: 'Is there a secondary insurance?',
          buttons: addNavigationButtons([
            { label: 'Yes, Medicare', value: 'medicare' },
            { label: 'Yes, MassHealth', value: 'masshealth' },
            { label: 'Yes, Other', value: 'other' },
            { label: 'No', value: 'no' },
          ], sessionData),
          next_state: 'awaiting_insurance',
          session_data: sessionData,
        };
      } else {
        return {
          text: 'Who is financially responsible for care (if different from patient)?',
          input_type: 'text',
          input_label: 'Responsible Party',
          input_placeholder: 'Name and relationship, or type "patient"',
          buttons: addNavigationButtons([
            { label: 'Patient', value: 'patient' },
          ], sessionData),
          next_state: 'awaiting_insurance',
          session_data: sessionData,
        };
      }

    // === ACCREDITATION FLOW ===
    case 'awaiting_business_info':
      if (!sessionData.business_name) {
        return {
          text: 'Great! What\'s your business or agency name?',
          input_type: 'text',
          input_label: 'Business Name',
          input_placeholder: 'Acme Home Care',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_business_info',
          session_data: sessionData,
        };
      } else {
        return {
          text: 'Where is your business located (city/state)?',
          input_type: 'text',
          input_label: 'Business Location',
          input_placeholder: 'Boston, MA',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_business_info',
          session_data: sessionData,
        };
      }

    case 'awaiting_support_type':
      return {
        text: 'What type of support are you looking for? (Select all that apply)',
        buttons: addNavigationButtons([
          { label: 'Licensing', value: 'licensing' },
          { label: 'Accreditation', value: 'accreditation' },
          { label: 'Compliance', value: 'compliance' },
          { label: 'Operations', value: 'operations' },
          { label: 'Expansion', value: 'expansion' },
          { label: 'Continue →', value: 'continue' },
        ], sessionData),
        next_state: 'awaiting_support_type',
        session_data: sessionData,
      };

    case 'awaiting_agency_status':
      return {
        text: 'What is your agency\'s current status?',
        buttons: addNavigationButtons([
          { label: 'New / Pre-licensing', value: 'new_prelicensing' },
          { label: 'Licensed but not accredited', value: 'licensed_not_accredited' },
          { label: 'Accredited and expanding', value: 'accredited_expanding' },
        ], sessionData),
        next_state: 'awaiting_agency_status',
        session_data: sessionData,
      };

    case 'awaiting_start_date':
      return {
        text: 'When would you like to get started?',
        input_type: 'date',
        input_label: 'Preferred Start Date',
        input_placeholder: 'MM/DD/YYYY',
        buttons: addNavigationButtons([], sessionData),
        next_state: 'awaiting_start_date',
        session_data: sessionData,
      };

    case 'awaiting_notes_accreditation':
      return {
        text: 'Is there anything else you\'d like us to know about your needs?',
        input_type: 'text',
        input_label: 'Additional Notes (Optional)',
        input_placeholder: 'Any specific goals or concerns...',
        buttons: addNavigationButtons([
          { label: 'Skip', value: 'skip' },
        ], sessionData),
        next_state: 'awaiting_notes_accreditation',
        session_data: sessionData,
      };

    // === STAFFING FLOW ===
    case 'awaiting_discipline':
      return {
        text: 'Great! What discipline or role are you interested in?',
        buttons: addNavigationButtons([
          { label: 'PT (Physical Therapist)', value: 'pt' },
          { label: 'PTA (Physical Therapist Assistant)', value: 'pta' },
          { label: 'OT (Occupational Therapist)', value: 'ot' },
          { label: 'COTA (Certified OT Assistant)', value: 'cota' },
          { label: 'Speech Therapist', value: 'speech_therapist' },
          { label: 'RN (Registered Nurse)', value: 'rn' },
          { label: 'LPN (Licensed Practical Nurse)', value: 'lpn' },
          { label: 'HHA/CNA', value: 'hha_cna' },
        ], sessionData),
        next_state: 'awaiting_discipline',
        session_data: sessionData,
      };

    case 'awaiting_license':
      if (!sessionData.license_number) {
        return {
          text: 'What is your license number?',
          input_type: 'text',
          input_label: 'License Number',
          input_placeholder: 'e.g., PT12345',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_license',
          session_data: sessionData,
        };
      } else {
        return {
          text: 'What state is your license in?',
          input_type: 'text',
          input_label: 'License State',
          input_placeholder: 'e.g., MA',
          buttons: addNavigationButtons([], sessionData),
          next_state: 'awaiting_license',
          session_data: sessionData,
        };
      }

    case 'awaiting_experience':
      return {
        text: 'How many years of experience do you have?',
        buttons: addNavigationButtons([
          { label: 'Less than 1 year', value: 'less_than_1' },
          { label: '1-3 years', value: '1_to_3' },
          { label: '3-5 years', value: '3_to_5' },
          { label: '5-10 years', value: '5_to_10' },
          { label: '10+ years', value: '10_plus' },
        ], sessionData),
        next_state: 'awaiting_experience',
        session_data: sessionData,
      };

    case 'awaiting_work_area':
      return {
        text: 'What geographic area do you prefer to work in?',
        buttons: addNavigationButtons([
          { label: 'Boston', value: 'boston' },
          { label: 'Worcester', value: 'worcester' },
          { label: 'Springfield', value: 'springfield' },
          { label: 'Other MA', value: 'other_ma' },
          { label: 'Custom Location', value: 'custom' },
        ], sessionData),
        next_state: 'awaiting_work_area',
        session_data: sessionData,
      };

    case 'awaiting_availability':
      return {
        text: 'What is your availability?',
        buttons: addNavigationButtons([
          { label: 'Full-time', value: 'full_time' },
          { label: 'Part-time', value: 'part_time' },
          { label: 'Per Diem', value: 'per_diem' },
        ], sessionData),
        next_state: 'awaiting_availability',
        session_data: sessionData,
      };

    case 'awaiting_transportation':
      return {
        text: 'Do you have reliable transportation?',
        buttons: addNavigationButtons([
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ], sessionData),
        next_state: 'awaiting_transportation',
        session_data: sessionData,
      };

    case 'awaiting_consent':
      return {
        text: 'Do you consent to a background check as required for employment?',
        buttons: addNavigationButtons([
          { label: 'Yes, I consent', value: 'yes' },
          { label: 'No', value: 'no' },
        ], sessionData),
        next_state: 'awaiting_consent',
        session_data: sessionData,
      };

    case 'awaiting_submit_confirmation':
      return {
        text: 'Perfect! We have all the information we need. Are you ready to submit?',
        buttons: addNavigationButtons([
          { label: '✅ Yes, Submit', value: 'submit' },
        ], sessionData),
        next_state: 'awaiting_submit_confirmation',
        session_data: sessionData,
      };

    case 'complete':
      return getHomeScreen();

    // Default: go to home
    default:
      return getHomeScreen();
  }
}

// Handle incoming chat message
export async function handleChatMessage(request: ChatRequest, ipHash: string): Promise<BotResponse> {
  const { message, session_data } = request;

  // Log event (no raw user input)
  logger.info('chat_message_received', {
    session_id: request.session_id,
    ip_hash: ipHash,
    message_length: message.length,
  });

  // PHI guard - reject if sensitive data detected
  if (containsPHI(message)) {
    logger.warn('phi_detected', {
      session_id: request.session_id,
      ip_hash: ipHash,
    });

    return {
      text: 'Please do not share medical details, diagnosis, medications, or personal health information. For your privacy and security, contact us directly at (617) 427-8494 or visit kekarehabservices.com/contact-us/ to discuss your needs.',
      buttons: addNavigationButtons([], session_data),
      next_state: 'awaiting_user_choice',
      session_data: {
        ...session_data,
        state: 'awaiting_user_choice',
      },
    };
  }

  // Handle special commands
  if (message.toLowerCase() === 'home' || message.toLowerCase() === 'start') {
    const homeScreen = getHomeScreen();
    return {
      ...homeScreen,
      session_data: clearHistory(homeScreen.session_data || {}),
    };
  }

  // Handle back navigation
  if (message.toLowerCase() === 'back') {
    const previousState = popState(session_data || {});

    if (previousState) {
      // Restore previous state and return appropriate response
      return restoreStateResponse(previousState);
    } else {
      // No history, go to home
      return getHomeScreen();
    }
  }

  // State machine routing
  const currentState = session_data?.state || 'awaiting_user_choice';
  const currentCategory = session_data?.category;

  switch (currentState) {
    case 'awaiting_user_choice':
      return handleUserChoice(message, session_data);

    case 'awaiting_contact':
      return handleAwaitingContact(message, session_data);

    // Patient intake flow states
    case 'awaiting_dob':
      return handleAwaitingDOB(message, session_data);

    case 'awaiting_gender':
      return handleAwaitingGender(message, session_data);

    case 'awaiting_address':
      return handleAwaitingAddress(message, session_data);

    case 'awaiting_emergency_contact':
      return handleAwaitingEmergencyContact(message, session_data);

    case 'awaiting_medical_info':
      return handleAwaitingMedicalInfo(message, session_data);

    case 'awaiting_assistive_devices':
      return handleAwaitingAssistiveDevices(message, session_data);

    case 'awaiting_services':
      return handleAwaitingServices(message, session_data);

    case 'awaiting_mobility':
      return handleAwaitingMobility(message, session_data);

    case 'awaiting_referral':
      return handleAwaitingReferral(message, session_data);

    case 'awaiting_insurance':
      return handleAwaitingInsurance(message, session_data);

    case 'awaiting_care_for':
      return handleAwaitingCareFor(message, session_data);

    case 'awaiting_setting':
      return await handleAwaitingSetting(message, session_data, ipHash, request.session_id);

    // Accreditation/Consulting flow states
    case 'awaiting_business_info':
      return handleAwaitingBusinessInfo(message, session_data);

    case 'awaiting_support_type':
      return handleAwaitingSupportType(message, session_data);

    case 'awaiting_agency_status':
      return handleAwaitingAgencyStatus(message, session_data);

    case 'awaiting_start_date':
      return handleAwaitingStartDate(message, session_data);

    case 'awaiting_notes_accreditation':
      logger.info('state_route_awaiting_notes_accreditation', {
        session_id: request.session_id,
        service_type: session_data?.service_type,
      });
      return await handleAwaitingNotesAccreditation(message, session_data, ipHash, request.session_id);

    // Staffing/Employment flow states
    case 'awaiting_discipline':
      return handleAwaitingDiscipline(message, session_data);

    case 'awaiting_license':
      return handleAwaitingLicense(message, session_data);

    case 'awaiting_experience':
      return handleAwaitingExperience(message, session_data);

    case 'awaiting_work_area':
      return handleAwaitingWorkArea(message, session_data);

    case 'awaiting_availability':
      return handleAwaitingAvailability(message, session_data);

    case 'awaiting_transportation':
      return handleAwaitingTransportation(message, session_data);

    case 'awaiting_consent':
      return await handleAwaitingConsent(message, session_data, ipHash, request.session_id);

    case 'awaiting_submit_confirmation':
      logger.info('state_route_awaiting_submit_confirmation', {
        session_id: request.session_id,
        service_type: session_data?.service_type,
        message: message,
      });
      return await handleAwaitingSubmitConfirmation(message, session_data, ipHash, request.session_id);

    case 'complete':
      return getHomeScreen();

    default:
      return getHomeScreen();
  }
}

// Handle user choice from menu
function handleUserChoice(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();

  // Patient / Client Intake flow
  if (choice === 'start_patient_intake') {
    const newSessionData = {
      ...sessionData,
      state: 'awaiting_contact',
      service_type: 'patient_intake',
      flow: 'patient_intake',
      awaiting_name: true,
    };
    return {
      text: 'Let\'s get started with your care request. What\'s your name?',
      input_type: 'text',
      input_label: 'Your Full Name',
      input_placeholder: 'John Smith',
      buttons: addNavigationButtons([], newSessionData),
      next_state: 'awaiting_contact',
      session_data: newSessionData,
    };
  }

  // Accreditation & Consulting Intake flow
  if (choice === 'start_accreditation_intake') {
    const newSessionData = {
      ...sessionData,
      state: 'awaiting_contact',
      service_type: 'accreditation_consulting',
      flow: 'accreditation_consulting',
      awaiting_name: true,
    };
    return {
      text: 'Welcome! Let\'s connect you with our accreditation and consulting team. What\'s your name?',
      input_type: 'text',
      input_label: 'Your Full Name',
      input_placeholder: 'John Smith',
      buttons: addNavigationButtons([], newSessionData),
      next_state: 'awaiting_contact',
      session_data: newSessionData,
    };
  }

  // Staffing & Employment Intake flow
  if (choice === 'start_staffing_intake') {
    const newSessionData = {
      ...sessionData,
      state: 'awaiting_contact',
      service_type: 'staffing_employment',
      flow: 'staffing_employment',
      awaiting_name: true,
    };
    return {
      text: 'Great! Let\'s get you connected with our staffing team. What\'s your name?',
      input_type: 'text',
      input_label: 'Your Full Name',
      input_placeholder: 'John Smith',
      buttons: addNavigationButtons([], newSessionData),
      next_state: 'awaiting_contact',
      session_data: newSessionData,
    };
  }

  // Check if it's a resolution response - just go back to home menu
  if (choice === 'resolved') {
    return getHomeScreen();
  }

  if (choice === 'contact_me' || choice === 'something_else') {
    // Log that user requested human help (email will be sent after they provide contact info)
    logger.info('user_requested_human_help', {
      session_id: sessionData?.session_id || 'unknown',
      context: sessionData?.category || 'unknown',
      flow: choice,
    });

    const messageText = choice === 'something_else'
      ? 'We can help you with that! How would you like us to reach you?'
      : 'We\'d love to help you directly. How would you like us to reach you?';

    const newSessionData = {
      ...sessionData,
      state: 'awaiting_contact',
      service_type: 'patient_intake', // Default to patient_intake
      flow: choice === 'something_else' ? 'something_else' : 'followup',
    };

    return {
      text: messageText,
      buttons: addNavigationButtons([
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
      ], newSessionData),
      next_state: 'awaiting_contact',
      session_data: newSessionData,
    };
  }

  // Check if it's a top-level category
  const categories = ['therapy_rehab', 'home_care', 'equipment', 'business', 'insurance', 'community'];
  if (categories.includes(choice)) {
    const buttons = getCategoryButtons(choice);
    const categoryName = getCategoryName(choice);
    const newSessionData = {
      ...sessionData,
      state: 'awaiting_user_choice',
      category: choice,
    };

    return {
      text: `Great! What can Keka help you with regarding ${categoryName}:`,
      buttons: addNavigationButtons(buttons, newSessionData),
      next_state: 'awaiting_user_choice',
      session_data: newSessionData,
    };
  }

  // Check if it's a specific question from a category
  const category = sessionData?.category;
  if (category) {
    const faqAnswer = getFAQAnswer(category, choice);
    if (faqAnswer) {
      // Show answer with links, then immediately show navigation options
      return {
        text: faqAnswer.answer,
        links: faqAnswer.links,
        buttons: addNavigationButtons([], sessionData),
        next_state: 'awaiting_user_choice',
        session_data: {
          ...sessionData,
          state: 'awaiting_user_choice',
        },
      };
    }
  }

  // Fallback: try retrieval or show home
  return getHomeScreen();
}

// Handle contact type selection and value input
function handleAwaitingContact(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const serviceType = sessionData?.service_type;

  // Step 1: Collecting name
  if (sessionData?.awaiting_name) {
    const updatedSessionData = pushState(sessionData);
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_contact',
      contact_name: message,
      awaiting_name: false,
    };
    return {
      text: 'Thank you! How would you like us to reach you?',
      buttons: addNavigationButtons([
        { label: 'Email', value: 'email' },
        { label: 'Phone', value: 'phone' },
      ], finalSessionData),
      next_state: 'awaiting_contact',
      session_data: finalSessionData,
    };
  }

  // Step 2: If user is selecting contact type
  if (choice === 'email' || choice === 'phone') {
    const updatedSessionData = pushState(sessionData);
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_contact',
      contact_type: choice,
    };
    return {
      text: choice === 'email'
        ? 'Please enter your email address:'
        : 'Please enter your phone number:',
      input_type: choice === 'email' ? 'email' : 'phone',
      input_label: choice === 'email' ? 'Your Email Address' : 'Your Phone Number',
      input_placeholder: choice === 'email' ? 'you@example.com' : '(555) 123-4567',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_contact',
      session_data: finalSessionData,
    };
  }

  // Step 3: If user has provided contact value - branch based on flow type
  const contactType = sessionData?.contact_type;
  if (contactType) {
    // Validate contact value before proceeding
    if (!validateContact(contactType as 'phone' | 'email', message)) {
      return {
        text: contactType === 'email'
          ? 'Please enter a valid email address (e.g., you@example.com):'
          : 'Please enter a valid phone number with at least 10 digits:',
        input_type: contactType === 'email' ? 'email' : 'phone',
        input_label: contactType === 'email' ? 'Your Email Address' : 'Your Phone Number',
        input_placeholder: contactType === 'email' ? 'you@example.com' : '(555) 123-4567',
        buttons: addNavigationButtons([], sessionData),
        next_state: 'awaiting_contact',
        session_data: sessionData,
      };
    }

    const updatedSessionData = pushState(sessionData);
    const flow = sessionData?.flow;

    // If this is a simple "Contact me" or "Something else" request (not a full intake), send email immediately
    if (flow === 'followup' || flow === 'something_else') {
      const finalSessionData = {
        ...updatedSessionData,
        state: 'complete',
        contact_value: message,
      };

      // Add the user's contact value (email/phone) to the transcript
      const updatedTranscript = [
        ...(sessionData?.chat_transcript || []),
        {
          sender: 'user' as const,
          text: message,
          timestamp: new Date().toISOString(),
        },
      ];

      // Send email notification with chat transcript (async, don't wait)
      const notificationData = {
        serviceType: 'general_inquiry' as const,
        contactType: contactType as 'email' | 'phone',
        contactValue: message,
        contactName: sessionData?.contact_name,
        chatTranscript: updatedTranscript,
        timestamp: new Date().toISOString(),
        sessionId: sessionData?.session_id || 'unknown',
      };

      sendAdminNotificationEmail(notificationData).catch(error => {
        logger.error('contact_me_email_failed', {
          error: String(error),
        });
      });

      return {
        text: 'Thank you! Our team will reach out to you within 1-2 business days.\n\nFor urgent questions, call us at (617) 427-8494.',
        buttons: addNavigationButtons([], finalSessionData),
        next_state: 'complete',
        session_data: finalSessionData,
      };
    }

    // Patient intake flow (full form) - now goes to comprehensive intake (DOB first)
    if (serviceType === 'patient_intake' && flow === 'patient_intake') {
      const finalSessionData = {
        ...updatedSessionData,
        state: 'awaiting_dob',
        contact_value: message,
      };
      return {
        text: 'Thank you! Now let\'s collect some basic information. What is the patient\'s date of birth?',
        input_type: 'date',
        input_label: 'Date of Birth',
        input_placeholder: 'MM/DD/YYYY',
        buttons: addNavigationButtons([], finalSessionData),
        next_state: 'awaiting_dob',
        session_data: finalSessionData,
      };
    }

    // Accreditation/Consulting flow - goes to business info
    if (serviceType === 'accreditation_consulting') {
      const finalSessionData = {
        ...updatedSessionData,
        state: 'awaiting_business_info',
        contact_value: message,
      };
      return {
        text: 'Great! What\'s your business or agency name?',
        input_type: 'text',
        input_label: 'Business / Agency Name',
        input_placeholder: 'Acme Home Care Services',
        buttons: addNavigationButtons([], finalSessionData),
        next_state: 'awaiting_business_info',
        session_data: finalSessionData,
      };
    }

    // Staffing/Employment flow - goes to discipline selection
    if (serviceType === 'staffing_employment') {
      const finalSessionData = {
        ...updatedSessionData,
        state: 'awaiting_discipline',
        contact_value: message,
      };
      return {
        text: 'Perfect! What role are you interested in?',
        buttons: addNavigationButtons([
          { label: 'Physical Therapist (PT)', value: 'pt' },
          { label: 'PTA', value: 'pta' },
          { label: 'Occupational Therapist (OT)', value: 'ot' },
          { label: 'COTA', value: 'cota' },
          { label: 'Speech Therapist', value: 'speech_therapist' },
          { label: 'RN', value: 'rn' },
          { label: 'LPN', value: 'lpn' },
          { label: 'HHA / CNA', value: 'hha_cna' },
        ], finalSessionData),
        next_state: 'awaiting_discipline',
        session_data: finalSessionData,
      };
    }
  }

  // Shouldn't get here, but fallback to home
  return getHomeScreen();
}

// ========== NEW PATIENT INTAKE HANDLERS ==========

// Handle Date of Birth collection
function handleAwaitingDOB(message: string, sessionData: any): BotResponse {
  // Validate date format and range
  if (!validateDate(message)) {
    return {
      text: 'Please enter a valid date of birth (e.g., 1/15/1990 or 01/15/1990):',
      input_type: 'date',
      input_label: 'Date of Birth',
      input_placeholder: 'M/D/YYYY or MM/DD/YYYY',
      buttons: addNavigationButtons([], sessionData),
      next_state: 'awaiting_dob',
      session_data: sessionData,
    };
  }

  if (!validateDateRange(message)) {
    return {
      text: 'Please enter a date of birth between 1900 and the current year:',
      input_type: 'date',
      input_label: 'Date of Birth',
      input_placeholder: 'M/D/YYYY or MM/DD/YYYY',
      buttons: addNavigationButtons([], sessionData),
      next_state: 'awaiting_dob',
      session_data: sessionData,
    };
  }

  const updatedSessionData = pushState(sessionData);
  const finalSessionData = {
    ...updatedSessionData,
    state: 'awaiting_gender',
    date_of_birth: message,
  };

  return {
    text: 'Thank you! What is the patient\'s gender?',
    buttons: addNavigationButtons([
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Other', value: 'other' },
      { label: 'Prefer not to say', value: 'prefer_not_to_say' },
    ], finalSessionData),
    next_state: 'awaiting_gender',
    session_data: finalSessionData,
  };
}

// Handle Gender selection
function handleAwaitingGender(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  if (['male', 'female', 'other', 'prefer_not_to_say'].includes(choice)) {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_address',
      gender: choice,
      awaiting_address_step: 'street',
    };
    return {
      text: 'Great! Now, what is the patient\'s street address?',
      input_type: 'text',
      input_label: 'Street Address',
      input_placeholder: '123 Main Street, Apt 4B',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_address',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle Address collection (multi-step: street → city → state → zip)
function handleAwaitingAddress(message: string, sessionData: any): BotResponse {
  const step = sessionData?.awaiting_address_step || 'street';
  const updatedSessionData = pushState(sessionData);

  if (step === 'street') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_address',
      address_street: message,
      awaiting_address_step: 'city',
    };
    return {
      text: 'What city?',
      input_type: 'text',
      input_label: 'City',
      input_placeholder: 'Boston',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_address',
      session_data: finalSessionData,
    };
  }

  if (step === 'city') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_address',
      address_city: message,
      awaiting_address_step: 'state',
    };
    return {
      text: 'What state?',
      input_type: 'text',
      input_label: 'State',
      input_placeholder: 'MA',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_address',
      session_data: finalSessionData,
    };
  }

  if (step === 'state') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_address',
      address_state: message,
      awaiting_address_step: 'zip',
    };
    return {
      text: 'And the ZIP code?',
      input_type: 'text',
      input_label: 'ZIP Code',
      input_placeholder: '02101',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_address',
      session_data: finalSessionData,
    };
  }

  if (step === 'zip') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_emergency_contact',
      address_zip: message,
      awaiting_emergency_step: 'name',
    };
    return {
      text: 'Perfect! Now, who should we contact in case of an emergency? What is their name?',
      input_type: 'text',
      input_label: 'Emergency Contact Name',
      input_placeholder: 'John Doe',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_emergency_contact',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle Emergency Contact (multi-step: name → relationship → phone)
function handleAwaitingEmergencyContact(message: string, sessionData: any): BotResponse {
  const step = sessionData?.awaiting_emergency_step || 'name';
  const updatedSessionData = pushState(sessionData);

  if (step === 'name') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_emergency_contact',
      emergency_contact_name: message,
      awaiting_emergency_step: 'relationship',
    };
    return {
      text: 'What is their relationship to the patient?',
      input_type: 'text',
      input_label: 'Relationship',
      input_placeholder: 'Spouse, Parent, Sibling, etc.',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_emergency_contact',
      session_data: finalSessionData,
    };
  }

  if (step === 'relationship') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_emergency_contact',
      emergency_contact_relationship: message,
      awaiting_emergency_step: 'phone',
    };
    return {
      text: 'What is their phone number?',
      input_type: 'phone',
      input_label: 'Emergency Contact Phone',
      input_placeholder: '(555) 123-4567',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_emergency_contact',
      session_data: finalSessionData,
    };
  }

  if (step === 'phone') {
    // Validate phone format
    if (!validateContact('phone', message)) {
      return {
        text: 'Please enter a valid phone number with at least 10 digits:',
        input_type: 'phone',
        input_label: 'Emergency Contact Phone',
        input_placeholder: '(555) 123-4567',
        buttons: addNavigationButtons([], sessionData),
        next_state: 'awaiting_emergency_contact',
        session_data: sessionData,
      };
    }

    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_medical_info',
      emergency_contact_phone: message,
      awaiting_medical_step: 'diagnosis',
    };
    return {
      text: 'Now for some medical information. What is the primary diagnosis or reason for referral?',
      input_type: 'textarea',
      input_label: 'Primary Diagnosis / Reason for Referral',
      input_placeholder: 'e.g., Post-stroke rehab, knee replacement recovery, etc.',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_medical_info',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle Medical Information (multi-step: diagnosis → conditions → allergies → physician → physician_contact)
function handleAwaitingMedicalInfo(message: string, sessionData: any): BotResponse {
  const step = sessionData?.awaiting_medical_step || 'diagnosis';
  const updatedSessionData = pushState(sessionData);

  if (step === 'diagnosis') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_medical_info',
      primary_diagnosis: message,
      awaiting_medical_step: 'conditions',
    };
    return {
      text: 'Are there any secondary conditions we should know about?',
      input_type: 'textarea',
      input_label: 'Secondary Conditions (Optional)',
      input_placeholder: 'Diabetes, hypertension, arthritis, etc. or "None"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_conditions' },
      ], finalSessionData),
      next_state: 'awaiting_medical_info',
      session_data: finalSessionData,
    };
  }

  if (step === 'conditions') {
    const conditions = message.toLowerCase() === 'skip_conditions' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_medical_info',
      secondary_conditions: conditions,
      awaiting_medical_step: 'allergies',
    };
    return {
      text: 'Does the patient have any allergies?',
      input_type: 'textarea',
      input_label: 'Allergies (Optional)',
      input_placeholder: 'Medications, foods, environmental, etc. or "None"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_allergies' },
      ], finalSessionData),
      next_state: 'awaiting_medical_info',
      session_data: finalSessionData,
    };
  }

  if (step === 'allergies') {
    const allergies = message.toLowerCase() === 'skip_allergies' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_medical_info',
      allergies: allergies,
      awaiting_medical_step: 'physician',
    };
    return {
      text: 'Who is the patient\'s primary physician or provider?',
      input_type: 'text',
      input_label: 'Physician / Provider Name (Optional)',
      input_placeholder: 'Dr. Smith or "N/A"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_physician' },
      ], finalSessionData),
      next_state: 'awaiting_medical_info',
      session_data: finalSessionData,
    };
  }

  if (step === 'physician') {
    const physician = message.toLowerCase() === 'skip_physician' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_medical_info',
      physician_name: physician,
      awaiting_medical_step: 'physician_contact',
    };
    return {
      text: 'What is the physician\'s contact information?',
      input_type: 'text',
      input_label: 'Physician Contact (Optional)',
      input_placeholder: 'Phone number or office name, or "N/A"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_physician_contact' },
      ], finalSessionData),
      next_state: 'awaiting_medical_info',
      session_data: finalSessionData,
    };
  }

  if (step === 'physician_contact') {
    const physicianContact = message.toLowerCase() === 'skip_physician_contact' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_assistive_devices',
      physician_contact: physicianContact,
      assistive_devices: [],
    };
    return {
      text: 'Does the patient currently use any assistive devices? (Select all that apply)',
      buttons: addNavigationButtons([
        { label: 'Cane', value: 'cane' },
        { label: 'Walker', value: 'walker' },
        { label: 'Wheelchair', value: 'wheelchair' },
        { label: 'Oxygen', value: 'oxygen' },
        { label: 'Other', value: 'other' },
        { label: 'None', value: 'none' },
        { label: 'Done Selecting', value: 'done' },
      ], finalSessionData),
      next_state: 'awaiting_assistive_devices',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle Assistive Devices (multi-select)
function handleAwaitingAssistiveDevices(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const devices = sessionData?.assistive_devices || [];

  if (choice === 'done' || choice === 'none') {
    const updatedSessionData = pushState(sessionData);
    const finalDevices = choice === 'none' ? ['none'] : devices;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_services',
      assistive_devices: finalDevices,
      services_requested: [],
    };
    return {
      text: 'What services is the patient requesting? (Select all that apply)',
      buttons: addNavigationButtons([
        { label: 'Physical Therapy', value: 'pt' },
        { label: 'Occupational Therapy', value: 'ot' },
        { label: 'Speech Therapy', value: 'speech' },
        { label: 'Skilled Nursing', value: 'nursing' },
        { label: 'Home Health Aide', value: 'hha' },
        { label: 'Transportation', value: 'transportation' },
        { label: 'Equipment Evaluation', value: 'equipment' },
        { label: 'Done Selecting', value: 'done' },
      ], finalSessionData),
      next_state: 'awaiting_services',
      session_data: finalSessionData,
    };
  }

  // Add device to list (accumulate selections) - no pushState for accumulation
  if (['cane', 'walker', 'wheelchair', 'oxygen', 'other'].includes(choice)) {
    if (!devices.includes(choice)) {
      devices.push(choice);
    }
    const finalSessionData = {
      ...sessionData,
      state: 'awaiting_assistive_devices',
      assistive_devices: devices,
    };
    return {
      text: `Added: ${choice}. Select more or click "Done Selecting"`,
      buttons: addNavigationButtons([
        { label: 'Cane', value: 'cane' },
        { label: 'Walker', value: 'walker' },
        { label: 'Wheelchair', value: 'wheelchair' },
        { label: 'Oxygen', value: 'oxygen' },
        { label: 'Other', value: 'other' },
        { label: 'None', value: 'none' },
        { label: 'Done Selecting', value: 'done' },
      ], finalSessionData),
      next_state: 'awaiting_assistive_devices',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle Services Requested (multi-select)
function handleAwaitingServices(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const services = sessionData?.services_requested || [];

  if (choice === 'done') {
    const updatedSessionData = pushState(sessionData);
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_mobility',
      services_requested: services,
      awaiting_mobility_step: 'can_walk',
    };
    return {
      text: 'Can the patient walk independently?',
      buttons: addNavigationButtons([
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ], finalSessionData),
      next_state: 'awaiting_mobility',
      session_data: finalSessionData,
    };
  }

  // Add service to list - no pushState for accumulation
  if (['pt', 'ot', 'speech', 'nursing', 'hha', 'transportation', 'equipment'].includes(choice)) {
    if (!services.includes(choice)) {
      services.push(choice);
    }
    const finalSessionData = {
      ...sessionData,
      state: 'awaiting_services',
      services_requested: services,
    };
    return {
      text: `Added: ${choice}. Select more or click "Done Selecting"`,
      buttons: addNavigationButtons([
        { label: 'Physical Therapy', value: 'pt' },
        { label: 'Occupational Therapy', value: 'ot' },
        { label: 'Speech Therapy', value: 'speech' },
        { label: 'Skilled Nursing', value: 'nursing' },
        { label: 'Home Health Aide', value: 'hha' },
        { label: 'Transportation', value: 'transportation' },
        { label: 'Equipment Evaluation', value: 'equipment' },
        { label: 'Done Selecting', value: 'done' },
      ], finalSessionData),
      next_state: 'awaiting_services',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle Mobility Assessment (multi-step: can_walk → assistance_level → fall_history)
function handleAwaitingMobility(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const step = sessionData?.awaiting_mobility_step || 'can_walk';
  const updatedSessionData = pushState(sessionData);

  if (step === 'can_walk') {
    if (choice === 'yes' || choice === 'no') {
      const finalSessionData = {
        ...updatedSessionData,
        state: 'awaiting_mobility',
        can_walk_independently: choice,
        awaiting_mobility_step: 'assistance',
      };
      return {
        text: 'What level of assistance does the patient need for walking?',
        buttons: addNavigationButtons([
          { label: 'Independent', value: 'independent' },
          { label: 'Minimal Assist', value: 'minimal' },
          { label: 'Moderate Assist', value: 'moderate' },
          { label: 'Maximal Assist', value: 'maximal' },
          { label: 'Unable to Walk', value: 'unable' },
        ], finalSessionData),
        next_state: 'awaiting_mobility',
        session_data: finalSessionData,
      };
    }
  }

  if (step === 'assistance') {
    if (['independent', 'minimal', 'moderate', 'maximal', 'unable'].includes(choice)) {
      const finalSessionData = {
        ...updatedSessionData,
        state: 'awaiting_mobility',
        assistance_level: choice,
        awaiting_mobility_step: 'falls',
      };
      return {
        text: 'Has the patient had any falls in the last 6 months?',
        buttons: addNavigationButtons([
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ], finalSessionData),
        next_state: 'awaiting_mobility',
        session_data: finalSessionData,
      };
    }
  }

  if (step === 'falls') {
    if (choice === 'yes' || choice === 'no') {
      const finalSessionData = {
        ...updatedSessionData,
        state: 'awaiting_referral',
        fall_history: choice,
        awaiting_referral_step: 'source',
      };
      return {
        text: 'How did you hear about Keka Rehab Services?',
        buttons: addNavigationButtons([
          { label: 'Physician', value: 'physician' },
          { label: 'Adult Day Health', value: 'adult_day' },
          { label: 'Home Care Agency', value: 'home_care_agency' },
          { label: 'Family / Friend', value: 'family_friend' },
          { label: 'Online / Social Media', value: 'online' },
          { label: 'Other', value: 'other' },
        ], finalSessionData),
        next_state: 'awaiting_referral',
        session_data: finalSessionData,
      };
    }
  }

  return getHomeScreen();
}

// Handle Referral Source (multi-step: source → agency → contact)
function handleAwaitingReferral(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const step = sessionData?.awaiting_referral_step || 'source';
  const updatedSessionData = pushState(sessionData);

  if (step === 'source') {
    if (['physician', 'adult_day', 'home_care_agency', 'family_friend', 'online', 'other'].includes(choice)) {
      // If physician or agency referral, ask for details
      if (['physician', 'adult_day', 'home_care_agency'].includes(choice)) {
        const finalSessionData = {
          ...updatedSessionData,
          state: 'awaiting_referral',
          referral_source: choice,
          awaiting_referral_step: 'agency',
        };
        return {
          text: 'What is the name of the referring organization or contact?',
          input_type: 'text',
          input_label: 'Referral Agency / Contact Name (Optional)',
          input_placeholder: 'e.g., Boston Medical Center',
          buttons: addNavigationButtons([
            { label: 'Skip', value: 'skip_agency' },
          ], finalSessionData),
          next_state: 'awaiting_referral',
          session_data: finalSessionData,
        };
      } else {
        // For other sources, skip to insurance
        const finalSessionData = {
          ...updatedSessionData,
          state: 'awaiting_insurance',
          referral_source: choice,
          awaiting_insurance_step: 'primary',
        };
        return {
          text: 'Almost done! What is the patient\'s primary insurance provider?',
          input_type: 'text',
          input_label: 'Primary Insurance (Optional)',
          input_placeholder: 'e.g., Medicare, Blue Cross, etc. or "None"',
          buttons: addNavigationButtons([
            { label: 'Skip', value: 'skip_insurance' },
          ], finalSessionData),
          next_state: 'awaiting_insurance',
          session_data: finalSessionData,
        };
      }
    }
  }

  if (step === 'agency') {
    const agency = message.toLowerCase() === 'skip_agency' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_referral',
      referral_agency: agency,
      awaiting_referral_step: 'contact',
    };
    return {
      text: 'Do you have contact information for the referral source?',
      input_type: 'text',
      input_label: 'Referral Contact Info (Optional)',
      input_placeholder: 'Phone or email, or "N/A"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_contact' },
      ], finalSessionData),
      next_state: 'awaiting_referral',
      session_data: finalSessionData,
    };
  }

  if (step === 'contact') {
    const contact = message.toLowerCase() === 'skip_contact' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_insurance',
      referral_contact: contact,
      awaiting_insurance_step: 'primary',
    };
    return {
      text: 'Almost done! What is the patient\'s primary insurance provider?',
      input_type: 'text',
      input_label: 'Primary Insurance (Optional)',
      input_placeholder: 'e.g., Medicare, Blue Cross, etc. or "None"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_insurance' },
      ], finalSessionData),
      next_state: 'awaiting_insurance',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle Insurance Information (multi-step: primary → member_id → secondary → responsible_party)
function handleAwaitingInsurance(message: string, sessionData: any): BotResponse {
  const step = sessionData?.awaiting_insurance_step || 'primary';
  const updatedSessionData = pushState(sessionData);

  if (step === 'primary') {
    const insurance = message.toLowerCase() === 'skip_insurance' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_insurance',
      primary_insurance: insurance,
      awaiting_insurance_step: 'member_id',
    };
    return {
      text: 'What is the insurance member ID or policy number?',
      input_type: 'text',
      input_label: 'Member ID / Policy # (Optional)',
      input_placeholder: 'Policy number or "N/A"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_member_id' },
      ], finalSessionData),
      next_state: 'awaiting_insurance',
      session_data: finalSessionData,
    };
  }

  if (step === 'member_id') {
    const memberId = message.toLowerCase() === 'skip_member_id' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_insurance',
      insurance_member_id: memberId,
      awaiting_insurance_step: 'secondary',
    };
    return {
      text: 'Is there a secondary insurance?',
      input_type: 'text',
      input_label: 'Secondary Insurance (Optional)',
      input_placeholder: 'Secondary insurance name or "None"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_secondary' },
      ], finalSessionData),
      next_state: 'awaiting_insurance',
      session_data: finalSessionData,
    };
  }

  if (step === 'secondary') {
    const secondary = message.toLowerCase() === 'skip_secondary' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_insurance',
      secondary_insurance: secondary,
      awaiting_insurance_step: 'responsible',
    };
    return {
      text: 'If different from the patient, who is the responsible party for billing?',
      input_type: 'text',
      input_label: 'Responsible Party (Optional)',
      input_placeholder: 'Name or "Same as patient"',
      buttons: addNavigationButtons([
        { label: 'Skip', value: 'skip_responsible' },
      ], finalSessionData),
      next_state: 'awaiting_insurance',
      session_data: finalSessionData,
    };
  }

  if (step === 'responsible') {
    const responsible = message.toLowerCase() === 'skip_responsible' ? '' : message;
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_care_for',
      responsible_party: responsible,
    };
    return {
      text: 'Final question! Is this care request for you or a loved one?',
      buttons: addNavigationButtons([
        { label: 'For Me', value: 'self' },
        { label: 'For a Loved One', value: 'loved_one' },
      ], finalSessionData),
      next_state: 'awaiting_care_for',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// ========== END NEW PATIENT INTAKE HANDLERS ==========

// Handle care recipient selection
function handleAwaitingCareFor(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  if (choice === 'self' || choice === 'loved_one') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_setting',
      care_for: choice,
    };
    return {
      text: 'What care setting would work best?',
      buttons: addNavigationButtons([
        { label: 'In-Home', value: 'in_home' },
        { label: 'Adult Day Health', value: 'adult_day_health' },
        { label: 'Clinic Visit', value: 'clinic_visit' },
      ], finalSessionData),
      next_state: 'awaiting_setting',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle care setting selection
async function handleAwaitingSetting(message: string, sessionData: any, ipHash: string, sessionId: string): Promise<BotResponse> {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  if (choice === 'in_home' || choice === 'adult_day_health' || choice === 'clinic_visit') {
    // Store care setting and show submit button
    const settingLabels: Record<string, string> = {
      'in_home': 'In-Home Care',
      'adult_day_health': 'Adult Day Health',
      'clinic_visit': 'Clinic Visit',
    };

    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_submit_confirmation',
      care_setting: choice,
    };
    return {
      text: `Great! You've selected ${settingLabels[choice]}.\n\nYou're all set! Please review your information and click the button below to submit your intake form. Our team will contact you within 1-2 business days.`,
      buttons: addNavigationButtons([
        { label: 'Submit Intake Form', value: 'submit_intake' },
      ], finalSessionData),
      next_state: 'awaiting_submit_confirmation',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Helper to get category display name
function getCategoryName(categoryId: string): string {
  const names: Record<string, string> = {
    therapy_rehab: 'Therapy & Rehabilitation',
    home_care: 'Home Care & Staffing',
    equipment: 'Equipment & Home Safety',
    business: 'Business & Agency Support',
    insurance: 'Access, Insurance & Billing',
    community: 'Community & E-Commerce',
  };
  return names[categoryId] || categoryId;
}

// ===== ACCREDITATION/CONSULTING FLOW HANDLERS =====

// Handle business info collection (name and location)
function handleAwaitingBusinessInfo(message: string, sessionData: any): BotResponse {
  const updatedSessionData = pushState(sessionData);

  // Check if we're waiting for business name or location
  if (!sessionData.business_name) {
    // Store business name, ask for location
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_business_info',
      business_name: message,
    };
    return {
      text: 'Thank you! Where is your business located? (City, State)',
      input_type: 'text',
      input_label: 'Business Location',
      input_placeholder: 'Boston, MA',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_business_info',
      session_data: finalSessionData,
    };
  }

  // Store location, move to support type
  const finalSessionData = {
    ...updatedSessionData,
    state: 'awaiting_support_type',
    business_location: message,
    support_types: [],
  };
  return {
    text: 'What type of support do you need? (You can select multiple)',
    buttons: addNavigationButtons([
      { label: 'Accreditation', value: 'accreditation' },
      { label: 'Policies & Procedures', value: 'policies' },
      { label: 'Startup Consulting', value: 'startup' },
      { label: 'HR & Compliance', value: 'hr_compliance' },
      { label: 'EVV / Payroll Setup', value: 'evv_payroll' },
      { label: 'Marketing Strategy', value: 'marketing' },
      { label: 'Done Selecting', value: 'done' },
    ], finalSessionData),
    next_state: 'awaiting_support_type',
    session_data: finalSessionData,
  };
}

// Handle support type selection (multi-select)
function handleAwaitingSupportType(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const supportTypes = sessionData?.support_types || [];

  // If user clicks "Done Selecting", move to next state - PUSH STATE HERE
  if (choice === 'done') {
    if (supportTypes.length === 0) {
      return {
        text: 'Please select at least one type of support before continuing.',
        buttons: addNavigationButtons([
          { label: 'Accreditation', value: 'accreditation' },
          { label: 'Policies & Procedures', value: 'policies' },
          { label: 'Startup Consulting', value: 'startup' },
          { label: 'HR & Compliance', value: 'hr_compliance' },
          { label: 'EVV / Payroll Setup', value: 'evv_payroll' },
          { label: 'Marketing Strategy', value: 'marketing' },
          { label: 'Done Selecting', value: 'done' },
        ], sessionData),
        next_state: 'awaiting_support_type',
        session_data: sessionData,
      };
    }

    const updatedSessionData = pushState(sessionData);
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_agency_status',
    };
    return {
      text: 'What\'s your current agency status?',
      buttons: addNavigationButtons([
        { label: 'New / Pre-licensing', value: 'new_prelicensing' },
        { label: 'Licensed, Not Accredited', value: 'licensed_not_accredited' },
        { label: 'Accredited & Expanding', value: 'accredited_expanding' },
      ], finalSessionData),
      next_state: 'awaiting_agency_status',
      session_data: finalSessionData,
    };
  }

  // Add selected support type to list - NO PUSH STATE for accumulation
  const validTypes = ['accreditation', 'policies', 'startup', 'hr_compliance', 'evv_payroll', 'marketing'];
  if (validTypes.includes(choice) && !supportTypes.includes(choice)) {
    supportTypes.push(choice);
  }

  const finalSessionData = {
    ...sessionData,
    state: 'awaiting_support_type',
    support_types: supportTypes,
  };
  return {
    text: `Selected: ${supportTypes.length} type(s). Select more or click "Done Selecting" to continue.`,
    buttons: addNavigationButtons([
      { label: 'Accreditation', value: 'accreditation' },
      { label: 'Policies & Procedures', value: 'policies' },
      { label: 'Startup Consulting', value: 'startup' },
      { label: 'HR & Compliance', value: 'hr_compliance' },
      { label: 'EVV / Payroll Setup', value: 'evv_payroll' },
      { label: 'Marketing Strategy', value: 'marketing' },
      { label: 'Done Selecting', value: 'done' },
    ], finalSessionData),
    next_state: 'awaiting_support_type',
    session_data: finalSessionData,
  };
}

// Handle agency status selection
function handleAwaitingAgencyStatus(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  if (choice === 'new_prelicensing' || choice === 'licensed_not_accredited' || choice === 'accredited_expanding') {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_start_date',
      agency_status: choice,
    };
    return {
      text: 'When would you like to start? (e.g., "Immediately", "Next month", "Q2 2025")',
      buttons: addNavigationButtons([
        { label: 'Immediately', value: 'immediately' },
        { label: 'Within 1 month', value: 'within_1_month' },
        { label: 'Within 3 months', value: 'within_3_months' },
      ], finalSessionData),
      next_state: 'awaiting_start_date',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle preferred start date
function handleAwaitingStartDate(message: string, sessionData: any): BotResponse {
  // Validate date format
  if (!validateDate(message)) {
    return {
      text: 'Please enter a valid date (e.g., 3/15/2025 or 03/15/2025):',
      input_type: 'date',
      input_label: 'Preferred Start Date',
      input_placeholder: 'M/D/YYYY or MM/DD/YYYY',
      buttons: addNavigationButtons([], sessionData),
      next_state: 'awaiting_start_date',
      session_data: sessionData,
    };
  }

  const updatedSessionData = pushState(sessionData);
  const finalSessionData = {
    ...updatedSessionData,
    state: 'awaiting_notes_accreditation',
    preferred_start_date: message,
  };

  return {
    text: 'Do you have any additional questions or details you\'d like to share? (Type your message or click "Skip")',
    input_type: 'textarea',
    input_label: 'Additional Notes or Questions (Optional)',
    input_placeholder: 'Tell us more about your needs...',
    buttons: addNavigationButtons([
      { label: 'Skip', value: 'skip' },
    ], finalSessionData),
    next_state: 'awaiting_notes_accreditation',
    session_data: finalSessionData,
  };
}

// Handle additional notes and complete accreditation intake
async function handleAwaitingNotesAccreditation(message: string, sessionData: any, ipHash: string, sessionId: string): Promise<BotResponse> {
  const choice = message.toLowerCase();
  const notes = choice === 'skip' ? undefined : message;
  const updatedSessionData = pushState(sessionData);

  // DEBUG: Log that we reached this handler
  logger.info('handleAwaitingNotesAccreditation_called', {
    session_id: sessionId,
    message_choice: choice,
    service_type: sessionData.service_type,
  });

  // Store notes and show submit button
  const finalSessionData = {
    ...updatedSessionData,
    state: 'awaiting_submit_confirmation',
    notes_accreditation: notes,
  };

  logger.info('accreditation_showing_submit_button', {
    session_id: sessionId,
    next_state: 'awaiting_submit_confirmation',
    service_type: sessionData.service_type,
  });

  return {
    text: 'Perfect! You\'re all set! Please review your information and click the button below to submit your request. Our accreditation and consulting team will contact you within 1-2 business days.',
    buttons: addNavigationButtons([
      { label: 'Submit Intake Form', value: 'submit_intake' },
    ], finalSessionData),
    next_state: 'awaiting_submit_confirmation',
    session_data: finalSessionData,
  };
}

// ===== STAFFING/EMPLOYMENT FLOW HANDLERS =====

// Handle discipline/role selection
function handleAwaitingDiscipline(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const validDisciplines = ['pt', 'pta', 'ot', 'cota', 'speech_therapist', 'rn', 'lpn', 'hha_cna'];
  const updatedSessionData = pushState(sessionData);

  if (validDisciplines.includes(choice)) {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_license',
      discipline: choice,
    };
    return {
      text: 'Great! Please provide your license number and state (e.g., "MA12345 - Massachusetts"). If you don\'t have a license yet, click "I don\'t have a license".',
      input_type: 'text',
      input_label: 'License Number and State',
      input_placeholder: 'MA12345 - Massachusetts',
      buttons: addNavigationButtons([
        { label: 'I don\'t have a license', value: 'none' },
      ], finalSessionData),
      next_state: 'awaiting_license',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle license information
function handleAwaitingLicense(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  // Parse license info or store "none"
  let licenseNumber, licenseState;
  if (choice !== 'none') {
    // Try to parse "NUMBER - STATE" format
    const parts = message.split('-').map(p => p.trim());
    if (parts.length >= 2) {
      licenseNumber = parts[0];
      licenseState = parts[1];
    } else {
      // Store as-is
      licenseNumber = message;
      licenseState = 'Not specified';
    }
  }

  const finalSessionData = {
    ...updatedSessionData,
    state: 'awaiting_experience',
    license_number: licenseNumber || 'None',
    license_state: licenseState || 'None',
  };
  return {
    text: 'How many years of experience do you have?',
    buttons: addNavigationButtons([
      { label: 'Less than 1 year', value: 'less_than_1' },
      { label: '1-3 years', value: '1_to_3' },
      { label: '3-5 years', value: '3_to_5' },
      { label: '5-10 years', value: '5_to_10' },
      { label: '10+ years', value: '10_plus' },
    ], finalSessionData),
    next_state: 'awaiting_experience',
    session_data: finalSessionData,
  };
}

// Handle years of experience
function handleAwaitingExperience(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const validExperience = ['less_than_1', '1_to_3', '3_to_5', '5_to_10', '10_plus'];
  const updatedSessionData = pushState(sessionData);

  if (validExperience.includes(choice)) {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_work_area',
      years_experience: choice,
    };
    return {
      text: 'Which area would you prefer to work in?',
      buttons: addNavigationButtons([
        { label: 'Boston', value: 'boston' },
        { label: 'Lynn', value: 'lynn' },
        { label: 'Waltham', value: 'waltham' },
        { label: 'Woburn', value: 'woburn' },
        { label: 'Other', value: 'other' },
      ], finalSessionData),
      next_state: 'awaiting_work_area',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle preferred work area
function handleAwaitingWorkArea(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  // If "other", let them type; otherwise accept button value
  if (choice !== 'other' && !sessionData.custom_work_area) {
    // Valid selection from buttons
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_availability',
      preferred_work_area: message,
    };
    return {
      text: 'What\'s your availability?',
      buttons: addNavigationButtons([
        { label: 'Full-time', value: 'full_time' },
        { label: 'Part-time', value: 'part_time' },
        { label: 'Per Diem', value: 'per_diem' },
      ], finalSessionData),
      next_state: 'awaiting_availability',
      session_data: finalSessionData,
    };
  }

  if (choice === 'other') {
    // Ask them to type custom location
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_work_area',
      custom_work_area: true,
    };
    return {
      text: 'Please type your preferred work area:',
      input_type: 'text',
      input_label: 'Preferred Work Area',
      input_placeholder: 'Cambridge, MA',
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'awaiting_work_area',
      session_data: finalSessionData,
    };
  }

  // Custom input received
  const finalSessionData = {
    ...updatedSessionData,
    state: 'awaiting_availability',
    preferred_work_area: message,
    custom_work_area: undefined,
  };
  return {
    text: 'What\'s your availability?',
    buttons: addNavigationButtons([
      { label: 'Full-time', value: 'full_time' },
      { label: 'Part-time', value: 'part_time' },
      { label: 'Per Diem', value: 'per_diem' },
    ], finalSessionData),
    next_state: 'awaiting_availability',
    session_data: finalSessionData,
  };
}

// Handle availability selection
function handleAwaitingAvailability(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const validAvailability = ['full_time', 'part_time', 'per_diem'];
  const updatedSessionData = pushState(sessionData);

  if (validAvailability.includes(choice)) {
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_transportation',
      availability: choice,
    };
    return {
      text: 'Do you have reliable transportation?',
      buttons: addNavigationButtons([
        { label: 'Yes', value: 'yes' },
        { label: 'No', value: 'no' },
      ], finalSessionData),
      next_state: 'awaiting_transportation',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle transportation access
function handleAwaitingTransportation(message: string, sessionData: any): BotResponse {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  if (choice === 'yes' || choice === 'no') {
    const hasTransportation = choice === 'yes';

    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_consent',
      has_transportation: hasTransportation,
    };
    return {
      text: 'By clicking "I Agree", you authorize Keka Rehab Services to contact you regarding staffing opportunities.',
      buttons: addNavigationButtons([
        { label: 'I Agree', value: 'agree' },
      ], finalSessionData),
      next_state: 'awaiting_consent',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle consent and complete staffing intake
async function handleAwaitingConsent(message: string, sessionData: any, ipHash: string, sessionId: string): Promise<BotResponse> {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  if (choice === 'agree') {
    // Store consent and show submit button
    const finalSessionData = {
      ...updatedSessionData,
      state: 'awaiting_submit_confirmation',
      consent_given: true,
    };
    return {
      text: 'Perfect! You\'re all set! Please review your information and click the button below to submit your application. Our staffing coordinator will contact you soon about available positions.',
      buttons: addNavigationButtons([
        { label: 'Submit Intake Form', value: 'submit_intake' },
      ], finalSessionData),
      next_state: 'awaiting_submit_confirmation',
      session_data: finalSessionData,
    };
  }

  return getHomeScreen();
}

// Handle submit confirmation - sends admin notifications and saves handoff request
async function handleAwaitingSubmitConfirmation(message: string, sessionData: any, ipHash: string, sessionId: string): Promise<BotResponse> {
  const choice = message.toLowerCase();
  const updatedSessionData = pushState(sessionData);

  // DEBUG: Log that we reached this handler
  logger.info('handleAwaitingSubmitConfirmation_called', {
    session_id: sessionId,
    choice: choice,
    service_type: sessionData.service_type,
    state: sessionData.state,
  });

  if (choice === 'submit_intake') {
    const serviceType = sessionData.service_type || 'patient_intake';

    // Prepare notification data based on service type
    const notificationData: any = {
      serviceType: serviceType,
      contactName: sessionData.contact_name,
      contactType: sessionData.contact_type,
      contactValue: sessionData.contact_value,
      chatTranscript: sessionData.chat_transcript || [], // Include chat conversation
      sessionId: sessionId,
      timestamp: new Date().toISOString(),
    };

    // Add service-specific fields
    if (serviceType === 'patient_intake') {
      Object.assign(notificationData, {
        dateOfBirth: sessionData.date_of_birth,
        gender: sessionData.gender,
        addressStreet: sessionData.address_street,
        addressCity: sessionData.address_city,
        addressState: sessionData.address_state,
        addressZip: sessionData.address_zip,
        emergencyContactName: sessionData.emergency_contact_name,
        emergencyContactRelationship: sessionData.emergency_contact_relationship,
        emergencyContactPhone: sessionData.emergency_contact_phone,
        primaryDiagnosis: sessionData.primary_diagnosis,
        secondaryConditions: sessionData.secondary_conditions,
        allergies: sessionData.allergies,
        physicianName: sessionData.physician_name,
        physicianContact: sessionData.physician_contact,
        assistiveDevices: sessionData.assistive_devices || [],
        servicesRequested: sessionData.services_requested || [],
        canWalkIndependently: sessionData.can_walk_independently,
        assistanceLevel: sessionData.assistance_level,
        fallHistory: sessionData.fall_history,
        referralSource: sessionData.referral_source,
        referralAgency: sessionData.referral_agency,
        referralContact: sessionData.referral_contact,
        primaryInsurance: sessionData.primary_insurance,
        insuranceMemberId: sessionData.insurance_member_id,
        secondaryInsurance: sessionData.secondary_insurance,
        responsibleParty: sessionData.responsible_party,
        careFor: sessionData.care_for,
        careSetting: sessionData.care_setting,
      });
    } else if (serviceType === 'accreditation_consulting') {
      Object.assign(notificationData, {
        businessName: sessionData.business_name,
        businessLocation: sessionData.business_location,
        supportTypes: sessionData.support_types || [],
        agencyStatus: sessionData.agency_status,
        preferredStartDate: sessionData.preferred_start_date,
        notesAccreditation: sessionData.notes_accreditation,
      });
    } else if (serviceType === 'staffing_employment') {
      Object.assign(notificationData, {
        discipline: sessionData.discipline,
        licenseNumber: sessionData.license_number,
        licenseState: sessionData.license_state,
        yearsExperience: sessionData.years_experience,
        preferredWorkArea: sessionData.preferred_work_area,
        availability: sessionData.availability,
        hasTransportation: sessionData.has_transportation,
        consentGiven: sessionData.consent_given,
      });
    }

    // Send admin email notification
    try {
      logger.info('sending_admin_notification', { service_type: serviceType, session_id: sessionId });

      // Send email notification (SMS disabled per user request)
      await sendAdminNotificationEmail(notificationData);

      logger.info('admin_notification_sent', { service_type: serviceType, session_id: sessionId });
    } catch (error) {
      logger.error('admin_notification_error', { error: String(error), service_type: serviceType });
      // Continue even if notification fails
    }

    // Save handoff request to file storage
    try {
      const handoffData: any = {
        service_type: serviceType,
        contact_name: sessionData.contact_name,
        contact_type: sessionData.contact_type,
        contact_value: sessionData.contact_value,
        chat_transcript: sessionData.chat_transcript || [], // Include chat conversation
        topic: sessionData.flow || serviceType,
        session_id: sessionId,
      };

      // Add service-specific fields to handoff data
      if (serviceType === 'patient_intake') {
        Object.assign(handoffData, {
          date_of_birth: sessionData.date_of_birth,
          gender: sessionData.gender,
          address_street: sessionData.address_street,
          address_city: sessionData.address_city,
          address_state: sessionData.address_state,
          address_zip: sessionData.address_zip,
          emergency_contact_name: sessionData.emergency_contact_name,
          emergency_contact_relationship: sessionData.emergency_contact_relationship,
          emergency_contact_phone: sessionData.emergency_contact_phone,
          primary_diagnosis: sessionData.primary_diagnosis,
          secondary_conditions: sessionData.secondary_conditions,
          allergies: sessionData.allergies,
          physician_name: sessionData.physician_name,
          physician_contact: sessionData.physician_contact,
          assistive_devices: sessionData.assistive_devices || [],
          services_requested: sessionData.services_requested || [],
          can_walk_independently: sessionData.can_walk_independently,
          assistance_level: sessionData.assistance_level,
          fall_history: sessionData.fall_history,
          referral_source: sessionData.referral_source,
          referral_agency: sessionData.referral_agency,
          referral_contact: sessionData.referral_contact,
          primary_insurance: sessionData.primary_insurance,
          insurance_member_id: sessionData.insurance_member_id,
          secondary_insurance: sessionData.secondary_insurance,
          responsible_party: sessionData.responsible_party,
          care_for: sessionData.care_for,
          care_setting: sessionData.care_setting,
        });
      } else if (serviceType === 'accreditation_consulting') {
        Object.assign(handoffData, {
          business_name: sessionData.business_name,
          business_location: sessionData.business_location,
          support_types: sessionData.support_types,
          agency_status: sessionData.agency_status,
          preferred_start_date: sessionData.preferred_start_date,
          notes_accreditation: sessionData.notes_accreditation,
        });
      } else if (serviceType === 'staffing_employment') {
        Object.assign(handoffData, {
          discipline: sessionData.discipline,
          license_number: sessionData.license_number,
          license_state: sessionData.license_state,
          years_experience: sessionData.years_experience,
          preferred_work_area: sessionData.preferred_work_area,
          availability: sessionData.availability,
          has_transportation: sessionData.has_transportation,
          consent_given: sessionData.consent_given,
        });
      }

      await saveHandoffRequest(handoffData, ipHash);
      logger.info('handoff_saved', { service_type: serviceType, session_id: sessionId });
    } catch (error) {
      logger.error('handoff_save_error', { error: String(error), service_type: serviceType });
      // Continue even if save fails
    }

    // Return success message based on service type
    let successMessage = '';
    if (serviceType === 'patient_intake') {
      successMessage = 'Thank you! Your request has been submitted. Our team will reach out to you within 1-2 business days to discuss your care needs.\n\nFor urgent questions, call us at (617) 427-8494.';
    } else if (serviceType === 'accreditation_consulting') {
      successMessage = 'Thank you! Your request has been submitted. Our accreditation and consulting team will reach out to you within 1-2 business days to discuss your needs.\n\nFor urgent questions, call us at (617) 427-8494.';
    } else if (serviceType === 'staffing_employment') {
      successMessage = 'Thank you! Your application has been submitted. Our staffing coordinator will review your information and contact you soon about available positions.\n\nFor urgent questions, call us at (617) 427-8494.';
    }

    const finalSessionData = {
      ...updatedSessionData,
      state: 'complete',
    };
    return {
      text: successMessage,
      buttons: addNavigationButtons([], finalSessionData),
      next_state: 'complete',
      session_data: finalSessionData,
    };
  }

  // If user didn't click submit, return home
  return getHomeScreen();
}
