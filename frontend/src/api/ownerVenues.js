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

// ── Persistent Owner Venue Selection ──────────────────────────────────────────

const SELECTED_VENUE_KEY = 'turfchai_owner_selected_venue_id';

/** Get the currently selected venue ID from localStorage */
export function getSavedSelectedVenueId() {
  try {
    const val = localStorage.getItem(SELECTED_VENUE_KEY);
    if (!val || val === 'null' || val === 'undefined' || val === 'NaN') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  } catch {
    return null;
  }
}

/** Save the currently selected venue ID to localStorage and broadcast change */
export function saveSelectedVenueId(venueId) {
  try {
    if (venueId != null && venueId !== 'null' && venueId !== 'undefined' && !isNaN(Number(venueId))) {
      localStorage.setItem(SELECTED_VENUE_KEY, String(venueId));
    } else {
      localStorage.removeItem(SELECTED_VENUE_KEY);
    }
    window.dispatchEvent(new CustomEvent('turfchai:venue-change', { detail: venueId }));
  } catch {
    // Ignore localStorage errors
  }
}

/** Resolve the active venue ID from a venue list against saved preference */
export function resolveActiveVenue(venueList) {
  if (!Array.isArray(venueList) || venueList.length === 0) return null;
  const savedId = getSavedSelectedVenueId();
  if (savedId != null) {
    const match = venueList.find((v) => Number(v.id) === Number(savedId) || String(v.id) === String(savedId));
    if (match && match.id) return match.id;
  }
  const fallbackId = venueList[0]?.id;
  if (fallbackId) {
    saveSelectedVenueId(fallbackId);
    return fallbackId;
  }
  return null;
}
