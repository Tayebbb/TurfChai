import { apiSend } from './client';

/**
 * POST /api/v1/pricing/quote
 * Returns the ML-computed dynamic price for a specific venue slot.
 *
 * @param {object} params
 * @param {number}  params.venueId
 * @param {string}  params.bookingDateTime  ISO-8601, e.g. "2026-08-10T18:00:00"
 * @param {number}  params.daysBeforeBooking
 * @param {number}  params.occupancyRate   0.0 – 1.0
 */
export function getPricingQuote({ venueId, bookingDateTime, daysBeforeBooking = 3, occupancyRate = 0.7 }) {
  return apiSend('POST', '/api/v1/pricing/quote', {
    venueId,
    bookingDateTime,
    daysBeforeBooking,
    occupancyRate,
  });
}
