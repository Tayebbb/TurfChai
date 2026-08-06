import { apiGet, apiSend } from '@/api/client';

/**
 * LFG ("looking for game") availability alerts (/api/v1/solo/lfg-alerts/**).
 *
 * Every route requires a bearer token, and each one also takes the acting
 * user's id explicitly — the controller does not read it from the JWT — so
 * callers must pass the id from `getUser()`. Responses are raw
 * LfgAlertResponse DTOs (no ApiResponse envelope).
 */

const BASE = '/api/v1/solo/lfg-alerts';

/**
 * POST /solo/lfg-alerts — creates an ACTIVE alert (201).
 * @param {{ userId: number, sportId?: number, sportName?: string, area: string,
 *   preferredDays?: string, preferredFrom?: string, preferredTo?: string,
 *   skillLevel?: string }} request
 *   Times are `"HH:mm:ss"`, `skillLevel` a SkillLevel enum name.
 */
export function createLfgAlert(request) {
  return apiSend('POST', BASE, request);
}

/** GET /solo/lfg-alerts?userId= — every alert belonging to one user. */
export function listLfgAlerts(userId) {
  return apiGet(BASE, { userId });
}

/**
 * PUT /solo/lfg-alerts/{id}/status — flips an alert between ACTIVE, PAUSED
 * and EXPIRED. Both ids and the status travel as query params.
 */
export function updateLfgAlertStatus(id, userId, status) {
  const params = new URLSearchParams({ userId: String(userId), status });
  return apiSend('PUT', `${BASE}/${encodeURIComponent(id)}/status?${params}`);
}

/** DELETE /solo/lfg-alerts/{id}?userId= — resolves to `null` (204). */
export function deleteLfgAlert(id, userId) {
  const params = new URLSearchParams({ userId: String(userId) });
  return apiSend('DELETE', `${BASE}/${encodeURIComponent(id)}?${params}`);
}

/**
 * GET /solo/lfg-alerts/{id}/matches — open games that currently satisfy the
 * alert's area / skill / time window.
 * @returns {Promise<Array>} OpenGameResponse[]
 */
export function getLfgAlertMatches(id) {
  return apiGet(`${BASE}/${encodeURIComponent(id)}/matches`);
}
