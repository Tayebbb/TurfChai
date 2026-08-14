import { api } from './client';

/**
 * Booking engine endpoints. All routes live under /api/v1/bookings/** and
 * require a bearer token, which the shared client attaches automatically.
 */

/** POST /api/v1/bookings/hold-slot — acquires a 5-minute hold. */
export function holdSlot(slotId) {
  return api('/bookings/hold-slot', { method: 'POST', body: { slotId } });
}

/** POST /api/v1/bookings — confirms the caller's hold into a booking. */
export function createBooking(slotId) {
  return api('/bookings', { method: 'POST', body: { slotId } });
}

/** GET /api/v1/bookings/{id} — booking detail for the owner/admin. */
export function getBooking(id) {
  return api(`/bookings/${encodeURIComponent(id)}`);
}

/** POST /api/v1/bookings/{id}/cancel — cancels a booking the caller owns. */
export function cancelBooking(id) {
  return api(`/bookings/${encodeURIComponent(id)}/cancel`, { method: 'POST' });
}

export function getMyBookings() {
  return api('/bookings', { method: 'GET' });
}

export function toBookingCard(booking) {
  const isUpcoming = booking.status === 'CONFIRMED' || booking.status === 'PENDING';
  return {
    id: booking.bookingCode,
    status: booking.status,
    statusTone: isUpcoming ? 'brand' : 'gray',
    title: booking.title,
    venue: booking.venue,
    pitch: booking.pitch,
    date: booking.date,
    time: booking.time,
    duration: booking.duration,
    share: booking.share,
    joinCode: booking.bookingCode,
  };
}
