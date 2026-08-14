import { apiSend } from './client';

/**
 * Booking-assistant chat endpoints.
 * Session ids are generated client-side and must match the backend's
 * [A-Za-z0-9_-] pattern.
 */

const SESSION_KEY = 'turfchai.assistant.session';

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(
      /[^A-Za-z0-9_-]/g,
      '',
    );
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

export function forgetSession() {
  localStorage.removeItem(SESSION_KEY);
}

/** POST /api/ai/chat */
export function sendMessage(message, sessionId) {
  return apiSend('POST', '/api/ai/chat', { sessionId, message });
}

/** DELETE /api/ai/sessions/{id} — clears transcript and structured state. */
export function resetSession(sessionId) {
  return apiSend('DELETE', `/api/ai/sessions/${encodeURIComponent(sessionId)}`);
}
