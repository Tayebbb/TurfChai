import { apiGet, apiSend, getUser, setSession } from './client';

/**
 * Player profile + saved venues endpoints. Every call here is scoped to the
 * JWT the client sends — the server derives the player from the token, so
 * there is no caller-supplied identity to spoof.
 */

/**
 * GET /api/v1/players/me
 *
 * Deliberately has no fallback: if the server will not tell us who the caller
 * is, the caller has no profile. Synthesising one from `localStorage` used to
 * hide 401s and let a signed-out visitor render as a real player.
 */
export function getMyProfile() {
  return apiGet('/api/v1/players/me');
}

/** GET /api/v1/players/me/stats — activity summary derived from the caller's own records. */
export function getMyStats() {
  return apiGet('/api/v1/players/me/stats');
}

/** PATCH /api/v1/players/me — null/omitted fields stay unchanged. */
export async function updateMyProfile(changes) {
  const res = await apiSend('PATCH', '/api/v1/players/me', changes);
  const currentUser = getUser() || {};
  const updatedUser = {
    ...currentUser,
    fullName: changes.fullName || currentUser.fullName || res?.fullName,
    area: changes.area || currentUser.area || res?.area,
    playerRole: changes.playerRole || currentUser.playerRole || res?.playerRole,
    playStyle: changes.playStyle || currentUser.playStyle || res?.playStyle,
    position: changes.position || currentUser.position || res?.position,
    preferredSports: changes.preferredSports ?? currentUser.preferredSports ?? res?.preferredSports,
    preferredTimes: changes.preferredTimes ?? currentUser.preferredTimes ?? res?.preferredTimes,
  };
  setSession({ user: updatedUser });
  return res;
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
