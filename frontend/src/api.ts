import { BotResponse, HandoffRequest } from './types';

// In production, VITE_API_URL is empty string (same-origin)
// In development, fallback to localhost:3001
const API_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : 'http://localhost:3001';

export async function sendChatMessage(
  message: string,
  sessionId: string,
  sessionData?: Record<string, any>
): Promise<BotResponse> {
  const response = await fetch(`${API_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      session_id: sessionId,
      session_data: sessionData,
    }),
  });

  if (!response.ok) {
    throw new Error('Failed to send message');
  }

  return response.json();
}

export async function submitHandoffRequest(request: HandoffRequest): Promise<{ success: boolean; id: string; message: string }> {
  const response = await fetch(`${API_URL}/api/handoff/request`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to submit request');
  }

  return response.json();
}
