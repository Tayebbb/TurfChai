import { apiFetch } from './client';

/**
 * Create a new LFG alert.
 * @param {Object} alertData
 */
export async function createLfgAlert(alertData) {
  return apiFetch('/api/v1/solo/lfg-alerts', {
    method: 'POST',
    body: JSON.stringify(alertData),
  });
}

/**
 * Fetch user LFG alerts.
 * @param {number|string} userId
 */
export async function fetchUserLfgAlerts(userId) {
  return apiFetch(`/api/v1/solo/lfg-alerts?userId=${userId}`);
}

/**
 * Update status of an LFG alert.
 * @param {number|string} id
 * @param {number|string} userId
 * @param {string} status - 'ACTIVE', 'PAUSED', 'EXPIRED', 'FULFILLED'
 */
export async function updateLfgAlertStatus(id, userId, status) {
  return apiFetch(`/api/v1/solo/lfg-alerts/${id}/status?userId=${userId}&status=${status}`, {
    method: 'PUT',
  });
}

/**
 * Delete an LFG alert.
 * @param {number|string} id
 * @param {number|string} userId
 */
export async function deleteLfgAlert(id, userId) {
  return apiFetch(`/api/v1/solo/lfg-alerts/${id}?userId=${userId}`, {
    method: 'DELETE',
  });
}

/**
 * Fetch matches for an LFG alert.
 * @param {number|string} id
 */
export async function fetchAlertMatches(id) {
  return apiFetch(`/api/v1/solo/lfg-alerts/${id}/matches`);
}
