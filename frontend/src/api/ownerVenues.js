import { apiGet, apiSend } from './client';

/** Owner venue management — /api/v1/owner/venues/**, requires an OWNER session. */

/** POST /api/v1/owner/venues — creates the venue in DRAFT with its coordinates. */
export function createVenue(venue) {
  return apiSend('POST', '/api/v1/owner/venues', venue);
}

/** GET /api/v1/owner/venues */
export function listMyVenues() {
  return apiGet('/api/v1/owner/venues');
}

/** PUT /api/v1/owner/venues/{id} — partial update; omitted fields stay unchanged. */
export function updateVenue(id, changes) {
  return apiSend('PUT', `/api/v1/owner/venues/${encodeURIComponent(id)}`, changes);
}
