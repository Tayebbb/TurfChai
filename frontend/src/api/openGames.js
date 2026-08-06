import { apiFetch } from './client';

/**
 * Fetch open games from backend.
 * @param {Object} [params]
 * @param {string} [params.skillLevel]
 * @param {string} [params.gameDate]
 * @param {string} [params.query]
 */
export async function fetchOpenGames(params = {}) {
  const queryParams = new URLSearchParams();
  if (params.skillLevel) queryParams.append('skillLevel', params.skillLevel);
  if (params.gameDate) queryParams.append('gameDate', params.gameDate);
  if (params.query) queryParams.append('query', params.query);

  const queryString = queryParams.toString();
  const endpoint = `/api/v1/solo/open-games${queryString ? `?${queryString}` : ''}`;
  return apiFetch(endpoint);
}

/**
 * Fetch a single open game by ID.
 * @param {number|string} id
 */
export async function fetchOpenGameById(id) {
  return apiFetch(`/api/v1/solo/open-games/${id}`);
}

/**
 * Fetch members for a specific open game.
 * @param {number|string} id
 */
export async function fetchOpenGameMembers(id) {
  return apiFetch(`/api/v1/solo/open-games/${id}/members`);
}

/**
 * Create a new open game.
 * @param {Object} gameData
 */
export async function createOpenGame(gameData) {
  return apiFetch('/api/v1/solo/open-games', {
    method: 'POST',
    body: JSON.stringify(gameData),
  });
}

/**
 * Join an open game.
 * @param {number|string} id
 * @param {Object} joinData
 */
export async function joinOpenGame(id, joinData) {
  return apiFetch(`/api/v1/solo/open-games/${id}/join`, {
    method: 'POST',
    body: JSON.stringify(joinData),
  });
}

/**
 * Update member attendance for an open game.
 * @param {number|string} id
 * @param {number|string} userId
 * @param {boolean} showUp
 */
export async function updateMemberAttendance(id, userId, showUp) {
  return apiFetch(`/api/v1/solo/open-games/${id}/members/${userId}/attendance?showUp=${showUp}`, {
    method: 'POST',
  });
}
