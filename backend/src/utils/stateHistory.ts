/**
 * State History Management for Back Navigation
 *
 * This utility manages the history of states and session data to enable
 * users to navigate back to previous questions and edit their inputs.
 *
 * Key Features:
 * - Stores snapshots of session data at each state transition
 * - Supports push/pop operations for navigation
 * - Limits history depth to prevent memory issues
 * - Blocks back navigation from certain states (home, complete)
 */

interface StateSnapshot {
  state: string;
  data: Record<string, any>;
  timestamp: number;
}

// Maximum history depth to prevent memory issues
const MAX_HISTORY_DEPTH = 50;

// States where back navigation should be disabled
const NO_BACK_STATES = [
  'awaiting_user_choice',  // Home menu
  'complete',              // Terminal state
];

/**
 * Push current state to history before transitioning to next state
 *
 * @param sessionData - Current session data
 * @returns Updated session data with new history entry
 */
export function pushState(sessionData: Record<string, any>): Record<string, any> {
  const history: StateSnapshot[] = sessionData.state_history || [];

  // Create snapshot of current state before transition
  // IMPORTANT: Exclude state_history from the snapshot to prevent exponential growth
  const { state_history, can_go_back, ...dataWithoutHistory } = sessionData;
  const snapshot: StateSnapshot = {
    state: sessionData.state || 'awaiting_user_choice',
    data: dataWithoutHistory,
    timestamp: Date.now(),
  };

  // Add to history, respecting max depth
  const newHistory = [...history, snapshot].slice(-MAX_HISTORY_DEPTH);

  return {
    ...sessionData,
    state_history: newHistory,
    can_go_back: newHistory.length > 0,
  };
}

/**
 * Pop the most recent state from history and restore it
 *
 * @param sessionData - Current session data
 * @returns Previous session data or null if no history available
 */
export function popState(sessionData: Record<string, any>): Record<string, any> | null {
  const history: StateSnapshot[] = sessionData.state_history || [];

  if (history.length === 0) {
    return null; // No history to go back to
  }

  // Get previous state snapshot
  const newHistory = [...history];
  const previousSnapshot = newHistory.pop()!;

  // Restore previous state data
  return {
    ...previousSnapshot.data,
    state_history: newHistory,
    can_go_back: newHistory.length > 0,
  };
}

/**
 * Check if back navigation is allowed from current state
 *
 * @param sessionData - Current session data
 * @returns True if user can go back, false otherwise
 */
export function canGoBack(sessionData: Record<string, any>): boolean {
  const currentState = sessionData?.state || 'awaiting_user_choice';

  // Check if current state allows back navigation
  if (NO_BACK_STATES.includes(currentState)) {
    return false;
  }

  // Check if there's history to go back to
  const history: StateSnapshot[] = sessionData.state_history || [];
  return history.length > 0;
}

/**
 * Clear all state history (used when returning home or completing flow)
 *
 * @param sessionData - Current session data
 * @returns Session data with cleared history
 */
export function clearHistory(sessionData: Record<string, any>): Record<string, any> {
  return {
    ...sessionData,
    state_history: [],
    can_go_back: false,
  };
}
