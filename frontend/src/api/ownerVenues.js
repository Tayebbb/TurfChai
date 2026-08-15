import { apiGet, apiSend, apiUpload } from './client';

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

/** PUT /api/v1/owner/venues/{id}/status — update live status (LIVE / OFFLINE). */
export function updateVenueStatus(id, status) {
  return apiSend('PUT', `/api/v1/owner/venues/${encodeURIComponent(id)}/status`, { status });
}

/** POST /api/v1/media/venues/{id}/photo — upload photo file to Cloudinary & save to DB. */
export function uploadVenuePhotoApi(id, file) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload(`/api/v1/media/venues/${encodeURIComponent(id)}/photo`, formData);
}

/** GET /api/v1/owner/venues/{id} */
export function getOwnerVenue(id) {
  return apiGet(`/api/v1/owner/venues/${encodeURIComponent(id)}`);
}

/** POST /api/v1/owner/venues/{id}/pitches */
export function addPitch(venueId, pitchData) {
  return apiSend('POST', `/api/v1/owner/venues/${encodeURIComponent(venueId)}/pitches`, pitchData);
}

/** PUT /api/v1/owner/venues/{id}/pitches/{pitchId} */
export function updatePitch(venueId, pitchId, pitchData) {
  return apiSend('PUT', `/api/v1/owner/venues/${encodeURIComponent(venueId)}/pitches/${encodeURIComponent(pitchId)}`, pitchData);
}

/** DELETE /api/v1/owner/venues/{id}/pitches/{pitchId} */
export function deactivatePitch(venueId, pitchId) {
  return apiSend('DELETE', `/api/v1/owner/venues/${encodeURIComponent(venueId)}/pitches/${encodeURIComponent(pitchId)}`);
}

/** POST /api/v1/owner/venues/{id}/pricing-rules */
export function upsertPricingRule(venueId, ruleData) {
  return apiSend('POST', `/api/v1/owner/venues/${encodeURIComponent(venueId)}/pricing-rules`, ruleData);
}

/** GET /api/v1/owner/venues/{id}/calendar?date=YYYY-MM-DD */
export function getOwnerCalendar(venueId, dateStr) {
  const query = dateStr ? `?date=${encodeURIComponent(dateStr)}` : '';
  return apiGet(`/api/v1/owner/venues/${encodeURIComponent(venueId)}/calendar${query}`);
}

/** POST /api/v1/owner/venues/{id}/slots/{slotId}/block */
export function blockOwnerSlot(venueId, slotId) {
  return apiSend('POST', `/api/v1/owner/venues/${encodeURIComponent(venueId)}/slots/${encodeURIComponent(slotId)}/block`);
}

/** POST /api/v1/owner/venues/{id}/slots/{slotId}/unblock */
export function unblockOwnerSlot(venueId, slotId) {
  return apiSend('POST', `/api/v1/owner/venues/${encodeURIComponent(venueId)}/slots/${encodeURIComponent(slotId)}/unblock`);
}

/** POST /api/v1/owner/venues/{id}/manual-booking */
export function createManualBooking(venueId, bookingData) {
  return apiSend('POST', `/api/v1/owner/venues/${encodeURIComponent(venueId)}/manual-booking`, bookingData);
}
