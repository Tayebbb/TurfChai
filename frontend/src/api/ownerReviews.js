import { apiGet, apiSend } from './client';

export function getOwnerReviews(params = {}) {
  return apiGet('/api/v1/owner/reviews', params);
}

/** Publishes the owner's public reply, shown under the review on the venue page. */
export function publishReviewResponse(reviewId, response) {
  return apiSend('POST', `/api/v1/owner/reviews/${encodeURIComponent(reviewId)}/response`, {
    response,
  });
}

