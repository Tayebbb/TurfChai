import { apiGet, apiSend } from './client';

export async function generateSlots(req) {
  return apiSend('POST', '/api/v1/owner/slots/generate', req);
}

export async function updateSlot(slotId, req) {
  return apiSend('PUT', `/api/v1/owner/slots/${slotId}`, req);
}

export async function getOwnerSlots(venueId, startDate, endDate) {
  return apiGet('/api/v1/owner/slots', { venueId, startDate, endDate });
}
