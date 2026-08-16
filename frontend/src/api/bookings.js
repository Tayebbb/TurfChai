import { api, apiDownload } from './client';
import { downloadBlob } from '@/utils/deviceActions';

/**
 * Booking engine endpoints. All routes live under /api/v1/bookings/** and
 * require a bearer token, which the shared client attaches automatically.
 */

/**
 * GET /api/v1/venues/{venueId}/slots?date=YYYY-MM-DD — a venue's bookable
 * slots for one day. Public (no auth) — same as venue browsing — so a
 * player can see availability before logging in.
 */
export function getVenueSlots(venueId, date) {
  return api(`/venues/${encodeURIComponent(venueId)}/slots?date=${encodeURIComponent(date)}`, { token: false });
}

/** POST /api/v1/bookings/hold-slot — acquires a 5-minute hold. */
export function holdSlot(slotId) {
  return api('/bookings/hold-slot', { method: 'POST', body: { slotId } });
}

/**
 * GET /api/v1/bookings/active-hold — the caller's currently held slot, if
 * any. Resolves to `{}` (no `slotId`) rather than rejecting when nothing is
 * held, so callers can treat "no hold" as data, not an error branch.
 */
export function getActiveHold() {
  return api('/bookings/active-hold');
}

/** GET /api/v1/bookings/{id} — booking detail for the owner/admin. */
export function getBooking(id) {
  return api(`/bookings/${encodeURIComponent(id)}`);
}

/** GET /api/v1/bookings — every booking belonging to the caller. */
export function listBookings() {
  return api('/bookings');
}

/** GET /api/v1/bookings/{id}/pdf — a downloadable PDF receipt/ticket for one booking. */
export function getBookingPdf(id) {
  return apiDownload(`/bookings/${encodeURIComponent(id)}/pdf`);
}

/**
 * Fetches a booking's PDF and triggers the browser download in one call, so
 * every "Download PDF" button (Booking Detail, My Bookings list) shares the
 * same fetch-then-save behaviour instead of each re-implementing it.
 */
export async function downloadBookingPdf(booking) {
  const blob = await getBookingPdf(booking.id);
  downloadBlob(`turfchai-${booking.bookingCode || booking.id}.pdf`, blob);
}

/** POST /api/v1/matchday/checkin?bookingId={id} — records the gate check-in. */
export function checkInBooking(bookingId) {
  return api(`/matchday/checkin?bookingId=${encodeURIComponent(bookingId)}`, { method: 'POST' });
}

/* ---------------------------------------------------------------------------
 * BookingResponse helpers — the DTO ships raw `LocalDate` / `LocalTime` /
 * `OffsetDateTime` strings, so every booking screen needs the same parsing,
 * grouping and display logic. It lives here next to the contract it decodes.
 * ------------------------------------------------------------------------- */

const pad = (value) => String(value).padStart(2, '0');

/** `"19:30:00"` → `{ hours: 19, minutes: 30 }`, or null when unparseable. */
function parseTime(time) {
  const [rawHours, rawMinutes] = String(time ?? '').split(':');
  const hours = Number(rawHours);
  const minutes = Number(rawMinutes);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? { hours, minutes } : null;
}

function toDate(bookingDate, time) {
  const parsed = parseTime(time);
  if (!bookingDate || !parsed) return null;
  const date = new Date(`${bookingDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(parsed.hours, parsed.minutes, 0, 0);
  return date;
}

function to12Hour(hours, minutes) {
  return { label: `${hours % 12 || 12}:${pad(minutes)}`, suffix: hours >= 12 ? 'PM' : 'AM' };
}

/** Local `Date` for a booking's kick-off. */
export function bookingStart(booking) {
  return toDate(booking?.bookingDate, booking?.startTime);
}

/** Local `Date` for a booking's final whistle. */
export function bookingEnd(booking) {
  const start = bookingStart(booking);
  const end = toDate(booking?.bookingDate, booking?.endTime);
  if (end && start && end <= start) end.setDate(end.getDate() + 1); // slot runs past midnight
  return end ?? start;
}

/** `Date` → `"7:20 PM"` */
export function formatTimeOfDay(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '—';
  const { label, suffix } = to12Hour(date.getHours(), date.getMinutes());
  return `${label} ${suffix}`;
}

/** Booking → `"Fri 8 Aug"` */
export function formatBookingDate(booking) {
  const start = bookingStart(booking);
  if (!start) return '—';
  return start.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** `("19:30:00", "21:00:00")` → `"7:30 – 9:00 PM"` */
export function formatTimeRange(startTime, endTime) {
  const start = parseTime(startTime);
  if (!start) return '—';
  const from = to12Hour(start.hours, start.minutes);
  const end = parseTime(endTime);
  if (!end) return `${from.label} ${from.suffix}`;
  const to = to12Hour(end.hours, end.minutes);
  return from.suffix === to.suffix
    ? `${from.label} – ${to.label} ${to.suffix}`
    : `${from.label} ${from.suffix} – ${to.label} ${to.suffix}`;
}

/** Which bookings tab a booking belongs to. */
function bookingGroup(booking, now = new Date()) {
  const status = String(booking?.status ?? '').toUpperCase();
  if (status === 'CANCELLED') return 'cancelled';
  if (status === 'COMPLETED') return 'completed';
  if (status === 'PENDING') return 'pending';
  const end = bookingEnd(booking);
  return end && end.getTime() <= now.getTime() ? 'completed' : 'upcoming';
}

/** Buckets a booking list into the four tabs, soonest-first for what's ahead. */
export function groupBookings(bookings, now = new Date()) {
  const groups = { upcoming: [], pending: [], completed: [], cancelled: [] };
  (Array.isArray(bookings) ? bookings : []).forEach((booking) => {
    groups[bookingGroup(booking, now)].push(booking);
  });
  const at = (booking) => bookingStart(booking)?.getTime() ?? 0;
  groups.upcoming.sort((a, b) => at(a) - at(b));
  groups.pending.sort((a, b) => at(a) - at(b));
  groups.completed.sort((a, b) => at(b) - at(a));
  groups.cancelled.sort((a, b) => at(b) - at(a));
  return groups;
}

/** The caller's next confirmed booking that has not finished yet. */
export function nextUpcomingBooking(bookings, now = new Date()) {
  return groupBookings(bookings, now).upcoming[0] ?? null;
}
