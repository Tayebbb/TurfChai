import { apiGet, apiSend } from './client';

/**
 * Player profile + saved venues endpoints. Identity is the seeded demo
 * player until authentication lands (X-User-Id header slot reserved).
 */

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
