import { apiGet, apiSend } from './client';

export function getOwnerBookings() {
  return apiGet('/api/v1/owner/bookings');
}

export function getOwnerCalendar() {
  return apiGet('/api/v1/owner/calendar');
}

/** Confirms a pending booking. */
export function approveOwnerBooking(bookingId) {
  return apiSend('POST', `/api/v1/owner/bookings/${encodeURIComponent(bookingId)}/approve`);
}

/** Cancels a booking and frees its slot. */
export function cancelOwnerBooking(bookingId) {
  return apiSend('POST', `/api/v1/owner/bookings/${encodeURIComponent(bookingId)}/cancel`);
}

/** Cancels and refunds per the venue's cancellation policy. */
export function refundOwnerBooking(bookingId) {
  return apiSend('POST', `/api/v1/owner/bookings/${encodeURIComponent(bookingId)}/refund`);
}

