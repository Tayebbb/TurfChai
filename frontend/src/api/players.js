import { apiGet } from './client';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';

/**
 * Player profile + saved venues endpoints. Identity is the seeded demo
 * player until authentication lands (X-User-Id header slot reserved).
 */

async function apiSend(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON body */
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

/** GET /api/v1/players/me */
export function getMyProfile() {
  return apiGet('/api/v1/players/me');
}

/** PATCH /api/v1/players/me — null/omitted fields stay unchanged. */
export function updateMyProfile(changes) {
  return apiSend('PATCH', '/api/v1/players/me', changes);
}

/** GET /api/v1/players/me/saved-venues */
export function getSavedVenues() {
  return apiGet('/api/v1/players/me/saved-venues');
}

/** POST toggle — resolves to { saved: boolean }. */
export function toggleSavedVenue(venueSlug) {
  return apiSend('POST', `/api/v1/players/me/saved-venues/${encodeURIComponent(venueSlug)}`);
}

/** DELETE — idempotent removal; use this for explicit "remove" actions. */
export function removeSavedVenue(venueSlug) {
  return apiSend('DELETE', `/api/v1/players/me/saved-venues/${encodeURIComponent(venueSlug)}`);
}
