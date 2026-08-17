/**
 * Device capabilities the browser already provides.
 *
 * These were all `showToast('Directions opened 🗺️')` and friends — a claim
 * that something happened when nothing did. None of them needs a backend.
 */

/** Whether we know enough to point a map at this venue. */
export function canGetDirections(venue) {
  return Boolean(venue?.lat != null && venue?.lng != null) || Boolean(venue?.address || venue?.name);
}

/**
 * Opens the platform's map app at the venue. Coordinates win when present
 * because an address string is ambiguous across Dhaka's repeated road names.
 */
export function openDirections(venue) {
  if (!canGetDirections(venue)) return false;
  const destination =
    venue.lat != null && venue.lng != null
      ? `${venue.lat},${venue.lng}`
      : [venue.name, venue.address, venue.area].filter(Boolean).join(', ');
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function canCall(phone) {
  return typeof phone === 'string' && /\d/.test(phone);
}

/** Hands the number to the dialler. On desktop this opens the OS handler. */
export function callNumber(phone) {
  if (!canCall(phone)) return false;
  window.location.href = `tel:${phone.replace(/[^+\d]/g, '')}`;
  return true;
}

function icsStamp(date) {
  return `${date.toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
}

function escapeIcs(value) {
  return String(value ?? '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');
}

/**
 * Builds a real calendar file. `date` is an ISO day and the times are local
 * "HH:mm:ss" strings, which is how the booking API returns them.
 */
export function buildIcs({ title, description, location, date, startTime, endTime, uid }) {
  if (!date || !startTime) return null;
  const start = new Date(`${date}T${startTime}`);
  const end = endTime ? new Date(`${date}T${endTime}`) : new Date(start.getTime() + 90 * 60000);
  if (Number.isNaN(start.getTime())) return null;

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TurfChai//Booking//EN',
    'BEGIN:VEVENT',
    `UID:${escapeIcs(uid || `${date}-${startTime}@turfchai`)}`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${escapeIcs(title)}`,
    description ? `DESCRIPTION:${escapeIcs(description)}` : null,
    location ? `LOCATION:${escapeIcs(location)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n');
}

/** Triggers a browser download of an already-built Blob (a PDF, an image). */
export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Some browsers write the download to disk asynchronously after the click
  // returns — revoking the blob URL immediately can race that write and hand
  // "Open" (from the browser's download prompt/bar) a truncated or empty
  // file. A short delay lets the write finish first.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

/** Triggers a download of any text payload. Used for .ics and .csv alike. */
export function downloadTextFile(filename, contents, mime = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([contents], { type: mime }));
}

export function addToCalendar(event) {
  const ics = buildIcs(event);
  if (!ics) return false;
  downloadTextFile(`${event.filename || 'turfchai-booking'}.ics`, ics, 'text/calendar;charset=utf-8');
  return true;
}

/**
 * Native share sheet where available, clipboard otherwise. Returns which one
 * happened so the caller can say something true.
 * @returns {Promise<'shared'|'copied'|'failed'>}
 */
export async function shareOrCopy({ title, text, url }) {
  const target = url || window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url: target });
      return 'shared';
    } catch (error) {
      // A user dismissing the sheet is not a failure worth reporting.
      if (error?.name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(target);
    return 'copied';
  } catch {
    return 'failed';
  }
}

/** RFC 4180 quoting — venue names and notes contain commas and quotes. */
function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * @param {string[]} headers
 * @param {Array<Array<unknown>>} rows
 */
export function toCsv(headers, rows) {
  return [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}

export function downloadCsv(filename, headers, rows) {
  // The BOM makes Excel read UTF-8 correctly, which matters for ৳ and Bangla names.
  downloadTextFile(filename, `\uFEFF${toCsv(headers, rows)}`, 'text/csv;charset=utf-8');
}
