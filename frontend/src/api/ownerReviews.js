import { apiGet } from './client';

export function getOwnerReviews() {
  return apiGet('/api/v1/owner/reviews');
}

