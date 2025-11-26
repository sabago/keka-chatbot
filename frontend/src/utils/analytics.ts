// Analytics tracking utility for chatbot usage metrics
// HIPAA-compliant: No PII or PHI is tracked

const API_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:3001';

// Event types that can be tracked
type AnalyticsEventType =
  | 'session_started'
  | 'session_ended'
  | 'button_clicked'
  | 'intake_flow_started'
  | 'intake_step_completed'
  | 'intake_flow_completed'
  | 'intake_flow_abandoned'
  | 'faq_category_viewed'
  | 'faq_question_viewed'
  | 'faq_resolution_feedback'
  | 'back_button_used'
  | 'phi_warning_triggered'
  | 'error_occurred'
  | 'chat_opened'
  | 'chat_closed';

interface AnalyticsEvent {
  event_type: AnalyticsEventType;
  session_id: string;
  metadata?: Record<string, any>;
}

// Session tracking state
let sessionStartTime: number | null = null;
let messageCount = 0;

/**
 * Send analytics event to backend
 * Fails silently to not disrupt user experience
 */
async function sendEvent(event: AnalyticsEvent): Promise<void> {
  try {
    await fetch(`${API_URL}/api/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    });
  } catch (error) {
    // Fail silently - analytics should never break the user experience
    console.debug('Analytics tracking failed:', error);
  }
}

/**
 * Track session start
 * Call this when the chatbot widget mounts/opens
 */
export function trackSessionStart(sessionId: string): void {
  sessionStartTime = Date.now();
  messageCount = 0;

  sendEvent({
    event_type: 'session_started',
    session_id: sessionId,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track session end
 * Call this when the chatbot widget unmounts/closes
 */
export function trackSessionEnd(sessionId: string): void {
  const duration = sessionStartTime
    ? Math.round((Date.now() - sessionStartTime) / 1000)
    : 0;

  sendEvent({
    event_type: 'session_ended',
    session_id: sessionId,
    metadata: {
      duration_seconds: duration,
      message_count: messageCount,
      timestamp: new Date().toISOString(),
    },
  });

  // Reset session state
  sessionStartTime = null;
  messageCount = 0;
}

/**
 * Track button click
 * Call this when user clicks any button in the chat
 */
export function trackButtonClick(
  sessionId: string,
  buttonLabel: string,
  buttonValue: string,
  currentState?: string
): void {
  sendEvent({
    event_type: 'button_clicked',
    session_id: sessionId,
    metadata: {
      button_label: buttonLabel,
      button_value: buttonValue,
      current_state: currentState,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track intake flow start
 * Call this when user begins an intake process
 */
export function trackIntakeFlowStart(
  sessionId: string,
  serviceType: string
): void {
  sendEvent({
    event_type: 'intake_flow_started',
    session_id: sessionId,
    metadata: {
      service_type: serviceType,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track intake step completion
 * Call this when user completes a step in the intake flow
 */
export function trackIntakeStepComplete(
  sessionId: string,
  serviceType: string,
  step: string,
  timeSpentSeconds?: number
): void {
  sendEvent({
    event_type: 'intake_step_completed',
    session_id: sessionId,
    metadata: {
      service_type: serviceType,
      step,
      time_spent_seconds: timeSpentSeconds,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track intake flow completion
 * Call this when user successfully completes the intake process
 */
export function trackIntakeFlowComplete(
  sessionId: string,
  serviceType: string,
  totalDurationSeconds: number
): void {
  sendEvent({
    event_type: 'intake_flow_completed',
    session_id: sessionId,
    metadata: {
      service_type: serviceType,
      total_duration_seconds: totalDurationSeconds,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track intake flow abandonment
 * Call this when user exits intake process before completing
 */
export function trackIntakeFlowAbandoned(
  sessionId: string,
  serviceType: string,
  lastCompletedStep: string,
  reason?: string
): void {
  sendEvent({
    event_type: 'intake_flow_abandoned',
    session_id: sessionId,
    metadata: {
      service_type: serviceType,
      last_completed_step: lastCompletedStep,
      abandonment_reason: reason,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track FAQ category view
 * Call this when user selects an FAQ category
 */
export function trackFAQCategoryView(
  sessionId: string,
  category: string
): void {
  sendEvent({
    event_type: 'faq_category_viewed',
    session_id: sessionId,
    metadata: {
      category,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track FAQ question view
 * Call this when user views a specific FAQ question/answer
 */
export function trackFAQQuestionView(
  sessionId: string,
  category: string,
  questionId: string
): void {
  sendEvent({
    event_type: 'faq_question_viewed',
    session_id: sessionId,
    metadata: {
      category,
      question_id: questionId,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track FAQ resolution feedback
 * Call this when user answers "Did this help?" for an FAQ
 */
export function trackFAQResolutionFeedback(
  sessionId: string,
  questionId: string,
  helpful: boolean
): void {
  sendEvent({
    event_type: 'faq_resolution_feedback',
    session_id: sessionId,
    metadata: {
      question_id: questionId,
      helpful,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track back button usage
 * Call this when user clicks "Back to Home" or navigates backward
 */
export function trackBackButtonUse(
  sessionId: string,
  fromState: string,
  toState: string
): void {
  sendEvent({
    event_type: 'back_button_used',
    session_id: sessionId,
    metadata: {
      from_state: fromState,
      to_state: toState,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track PHI warning trigger
 * Call this when PHI detection is triggered
 */
export function trackPHIWarning(sessionId: string): void {
  sendEvent({
    event_type: 'phi_warning_triggered',
    session_id: sessionId,
    metadata: {
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track error occurrence
 * Call this when an error occurs in the chatbot
 */
export function trackError(
  sessionId: string,
  errorType: string,
  errorCode?: string
): void {
  sendEvent({
    event_type: 'error_occurred',
    session_id: sessionId,
    metadata: {
      error_type: errorType,
      error_code: errorCode,
      timestamp: new Date().toISOString(),
    },
  });
}

/**
 * Track message sent (for internal counting)
 * Call this every time a user sends a message
 */
export function trackMessage(): void {
  messageCount++;
}

/**
 * Get current session duration in seconds
 */
export function getSessionDuration(): number {
  return sessionStartTime
    ? Math.round((Date.now() - sessionStartTime) / 1000)
    : 0;
}

/**
 * Get current message count
 */
export function getMessageCount(): number {
  return messageCount;
}
