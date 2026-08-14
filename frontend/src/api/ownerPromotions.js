import { apiGet, apiSend } from './client';

export function getOwnerPromotions(venueId) {
  return apiGet(`/api/v1/owner/venues/${venueId}/promotions`);
}

export function createPromotion(venueId, data) {
  return apiSend('POST', `/api/v1/owner/venues/${venueId}/promotions`, data);
}

export function updatePromotion(venueId, promoId, data) {
  return apiSend('PATCH', `/api/v1/owner/venues/${venueId}/promotions/${promoId}`, data);
}

export function deletePromotion(venueId, promoId) {
  return apiSend('DELETE', `/api/v1/owner/venues/${venueId}/promotions/${promoId}`);
}
