import { apiGet, apiSend, getUser, setSession } from './client';

/**
 * Player profile + saved venues endpoints. Identity is the seeded demo
 * player until authentication lands (X-User-Id header slot reserved).
 */

/** GET /api/v1/players/me */
export async function getMyProfile() {
  const localUser = getUser();
  try {
    const remote = await apiGet('/api/v1/players/me');
    if (localUser?.fullName && remote && (remote.fullName === 'Rafi A.' || !remote.fullName)) {
      return {
        ...remote,
        fullName: localUser.fullName,
        email: localUser.email || remote.email,
      };
    }
    return remote;
  } catch (err) {
    if (localUser) {
      return {
        fullName: localUser.fullName || '',
        email: localUser.email || '',
        area: localUser.area || '',
        playerRole: localUser.playerRole || '',
      };
    }
    throw err;
  }
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
