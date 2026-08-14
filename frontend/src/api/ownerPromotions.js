import { apiGet } from './client';

export function getOwnerPromotions() {
  return apiGet('/api/v1/owner/promotions');
}

