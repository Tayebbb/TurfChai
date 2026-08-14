import { apiGet, apiSend } from '@/api/client';

/**
 * LFG ("looking for game") availability alerts (/api/v1/solo/lfg-alerts/**).
 *
 * Every route requires a bearer token and acts on the alerts belonging to the
 * token's own user — there is no user id to pass, and one cannot be used to
 * reach someone else's alerts. Responses are raw LfgAlertResponse DTOs (no
 * ApiResponse envelope).
 */

const BASE = '/api/v1/solo/lfg-alerts';

/**
 * POST /solo/lfg-alerts — creates an ACTIVE alert (201) for the signed-in user.
 * @param {{ sportId?: number, sportName?: string, area: string,
 *   preferredDays?: string, preferredFrom?: string, preferredTo?: string,
 *   skillLevel?: string }} request
 *   Times are `"HH:mm:ss"`, `skillLevel` a SkillLevel enum name.
 */
export function createLfgAlert(request) {
  return apiSend('POST', BASE, request);
}

/** GET /solo/lfg-alerts — every alert belonging to the signed-in user. */
export function listLfgAlerts() {
  return apiGet(BASE);
}

/**
 * PUT /solo/lfg-alerts/{id}/status — flips an alert between ACTIVE, PAUSED
 * and EXPIRED.
 */
export function updateLfgAlertStatus(id, status) {
  const params = new URLSearchParams({ status });
  return apiSend('PUT', `${BASE}/${encodeURIComponent(id)}/status?${params}`);
}

/** DELETE /solo/lfg-alerts/{id} — resolves to `null` (204). */
export function deleteLfgAlert(id) {
  return apiSend('DELETE', `${BASE}/${encodeURIComponent(id)}`);
}

/**
 * GET /solo/lfg-alerts/{id}/matches — open games that currently satisfy the
 * alert's area / skill / time window.
 * @returns {Promise<Array>} OpenGameResponse[]
 */
export function getLfgAlertMatches(id) {
  return apiGet(`${BASE}/${encodeURIComponent(id)}/matches`);
}
