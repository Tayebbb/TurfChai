import { api, apiGet, apiSend } from './client';

/**
 * Split payment endpoints.
 */

/**
 * POST /api/v1/bookings/{bookingId}/split
 * Enables price splitting for a booking and creates share tokens.
 */
export function enableBookingSplit(bookingId, { playerCount }) {
  return api(`/bookings/${encodeURIComponent(bookingId)}/split`, {
    method: 'POST',
    body: { playerCount: Number(playerCount) },
  });
}

/**
 * GET /api/v1/bookings/{bookingId}/split
 * Fetches the split status and all member shares for a booking.
 */
export function getBookingSplitStatus(bookingId) {
  return api(`/bookings/${encodeURIComponent(bookingId)}/split`);
}

/**
 * GET /api/v1/bookings/share/{token}
 * Public endpoint to load share details for the pay-share page / QR code.
 */
export function getShareDetails(token) {
  return apiGet(`/api/v1/bookings/share/${encodeURIComponent(token)}`);
}

/**
 * POST /api/v1/bookings/share/{token}/pay
 * Public endpoint to complete payment for a friend's share.
 */
export function completeSharePayment(token, { paymentMethod, payerName, payerPhone }) {
  return apiSend('POST', `/api/v1/bookings/share/${encodeURIComponent(token)}/pay`, {
    paymentMethod,
    payerName,
    payerPhone,
  });
}
