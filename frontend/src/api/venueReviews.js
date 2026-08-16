import { apiGet } from '@/api/client';

/**
 * GET /api/v1/venues/{slug}/reviews — published reviews, newest first.
 * Public: a visitor reads reviews before deciding to book.
 * @returns {Promise<{items: Array, page: number, size: number, totalItems: number, hasMore: boolean}>}
 */
export function getVenueReviews(slug, { page = 0, size = 10 } = {}) {
  return apiGet(`/api/v1/venues/${encodeURIComponent(slug)}/reviews`, { page, size });
}
