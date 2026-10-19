import crypto from 'crypto';
import { BotResponse, ChatRequest, containsPHI, Button } from '../types/schema';
import { getHomeScreen, getCategoryButtons, getFAQAnswer, getResolutionButtons } from './faq';
import { generateRetrievalResponse } from './retrieve';
import { saveHandoffRequest, validateContact, validateDate } from './handoff';
import { sendContactNotification } from './email';
import { saveEvent } from './analytics';
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
    // Intake collects no health information (HIPAA): clinical, insurance and
    // demographic details are gathered by staff over the phone instead.
    case 'awaiting_care_for':
      return {
        text: 'Is this care request for you or a loved one?',
        buttons: addNavigationButtons([
          { label: 'For Me', value: 'self' },
          { label: 'For a Loved One', value: 'loved_one' },
        ], sessionData),
        next_state: 'awaiting_care_for',
        session_data: sessionData,
      };

    case 'awaiting_setting':
      return {
        text: 'What care setting would work best?',
        buttons: addNavigationButtons([
          { label: 'In-Home', value: 'in_home' },
          { label: 'Adult Day Health', value: 'adult_day_health' },
          { label: 'Clinic Visit', value: 'clinic_visit' },
        ], sessionData),
        next_state: 'awaiting_setting',
        session_data: sessionData,
      };

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
          { label: 'Yes, Submit', value: 'submit_intake' },
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
      text: 'Please do not share medical details, diagnosis, medications, or personal health information. For your privacy and security, contact us directly at (857)345-9589 or visit kekarehabservices.com/contact-us/ to discuss your needs.',
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
      return handleUserChoice(message, session_data, request.session_id, ipHash);

    case 'awaiting_contact':
      return handleAwaitingContact(message, session_data);

    // Patient intake flow states
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
function handleUserChoice(message: string, sessionData: any, sessionId: string, ipHash: string): BotResponse {
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
      // Record the view for the weekly report's "Most viewed FAQs".
      // Fire-and-forget: saveEvent never throws and must not delay the reply.
      void saveEvent({
        session_id: sessionId,
        event_type: 'faq_question_viewed',
        metadata: { category, question_id: faqAnswer.id },
        ip_hash: ipHash,
      });

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

      // Send email notification (async, don't wait). The chat transcript is
      // deliberately not included: visitors can type health details into it.
      const notificationData = {
        serviceType: 'general_inquiry' as const,
        contactType: contactType as 'email' | 'phone',
        contactValue: message,
        contactName: sessionData?.contact_name,
        timestamp: new Date().toISOString(),
        sessionId: sessionData?.session_id || 'unknown',
      };

      sendContactNotification(notificationData).catch(error => {
        logger.error('contact_me_email_failed', {
          error: String(error),
        });
      });

      return {
        text: 'Thank you! Our team will reach out to you within 1-2 business days.\n\nFor urgent questions, call us at (857)345-9589.',
        buttons: addNavigationButtons([], finalSessionData),
        next_state: 'complete',
        session_data: finalSessionData,
      };
    }

    // Patient intake flow - collects no health information (HIPAA).
    // Staff gather clinical and insurance details by phone.
    if (serviceType === 'patient_intake' && flow === 'patient_intake') {
      const finalSessionData = {
        ...updatedSessionData,
        state: 'awaiting_care_for',
        contact_value: message,
      };
      return {
        text: 'Thank you! Is this care request for you or a loved one?',
        buttons: addNavigationButtons([
          { label: 'For Me', value: 'self' },
          { label: 'For a Loved One', value: 'loved_one' },
        ], finalSessionData),
        next_state: 'awaiting_care_for',
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

    // Save handoff request to file storage
    try {
      const handoffData: any = {
        service_type: serviceType,
        contact_name: sessionData.contact_name,
        contact_type: sessionData.contact_type,
        contact_value: sessionData.contact_value,
        topic: sessionData.flow || serviceType,
        session_id: sessionId,
      };

      // Add service-specific fields to handoff data
      if (serviceType === 'patient_intake') {
        // No health information is collected for patient intake (HIPAA)
        Object.assign(handoffData, {
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
      successMessage = 'Thank you! Your request has been submitted. Our team will reach out to you within 1-2 business days to discuss your care needs.\n\nFor urgent questions, call us at (857)345-9589.';
    } else if (serviceType === 'accreditation_consulting') {
      successMessage = 'Thank you! Your request has been submitted. Our accreditation and consulting team will reach out to you within 1-2 business days to discuss your needs.\n\nFor urgent questions, call us at (857)345-9589.';
    } else if (serviceType === 'staffing_employment') {
      successMessage = 'Thank you! Your application has been submitted. Our staffing coordinator will review your information and contact you soon about available positions.\n\nFor urgent questions, call us at (857)345-9589.';
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
