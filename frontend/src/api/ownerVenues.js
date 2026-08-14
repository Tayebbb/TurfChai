import { apiSend } from './client';

export function createVenue(payload) {
  return apiSend('POST', '/api/v1/owner/venues', payload);
}
