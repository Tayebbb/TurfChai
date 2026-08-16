import { api } from './client';

/**
 * Payment endpoints. All routes live under /api/v1/payments/** and require
 * a bearer token, which the shared client attaches automatically. Every
 * response is wrapped in the backend's ApiResponse<T> envelope, so these
 * helpers unwrap `.data` for callers.
 */

/**
 * POST /api/v1/payments/checkout — pays for the caller's currently held
 * slot (mock bKash/Nagad/Card/Cash).
 */
export async function checkout({ slotId, method, applyWalletAmount, promoCode }) {
  const res = await api('/payments/checkout', {
    method: 'POST',
    body: { slotId, method, applyWalletAmount, promoCode },
  });
  return res.data;
}

/**
 * POST /api/v1/promotions/validate-code — quotes what a promo code is worth for
 * an order total. A quote only; the discount that actually applies is priced
 * again by the server during checkout, so this cannot be used to pay less.
 * Answers 422 with `valid: false` and a reason when the code does not apply.
 */
export async function validatePromoCode({ code, orderTotal, venueId }) {
  return api('/promotions/validate-code', {
    method: 'POST',
    body: { code, orderTotal, venueId },
  });
}

/**
 * GET /api/v1/venues/{venueId}/promotions/available — every promo code
 * currently redeemable at a venue, for the checkout page's "browse codes"
 * list. Public, no auth — same as venue/slot browsing.
 */
export function getAvailablePromoCodes(venueId) {
  return api(`/venues/${encodeURIComponent(venueId)}/promotions/available`, { token: false });
}

/** GET /api/v1/payments/booking/{bookingId} — a booking's payment history, most recent first. */
export async function getPaymentsForBooking(bookingId) {
  const res = await api(`/payments/booking/${encodeURIComponent(bookingId)}`);
  return res.data;
}

/** GET /api/v1/payments/refund-preview/{bookingId} — refund %/amount before confirming cancellation. */
export async function getRefundPreview(bookingId) {
  const res = await api(`/payments/refund-preview/${encodeURIComponent(bookingId)}`);
  return res.data;
}

/** POST /api/v1/payments/cancel/{bookingId} — cancels the booking and records the refund, if any. */
export async function cancelAndRefund(bookingId) {
  const res = await api(`/payments/cancel/${encodeURIComponent(bookingId)}`, { method: 'POST' });
  return res.data;
}
