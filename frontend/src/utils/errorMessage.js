/**
 * Turns a failed request into something a person can act on.
 *
 * The API's own 4xx messages are written for users ("Slot is not available for
 * booking") and are kept. What must never reach the screen is transport noise
 * (`Request failed with status 500`) or server internals that leak through a
 * message field — so 5xx always gets a generic line, and any message that
 * reads like a stack trace or a SQL error is replaced.
 */

const BY_STATUS = {
  400: 'Some of those details are not valid. Please check and try again.',
  401: 'Your session has expired. Please sign in again.',
  403: 'You do not have permission to do that.',
  404: 'We could not find what you were looking for.',
  405: 'That action is not supported here.',
  409: 'That could not be completed because something changed. Please refresh and try again.',
  413: 'That file is too large.',
  415: 'That file type is not supported.',
  422: 'Some of those details are not valid. Please check and try again.',
  429: 'Too many attempts. Please wait a moment and try again.',
  503: 'That service is temporarily unavailable. Please try again shortly.',
};

const GENERIC = 'Something went wrong. Please try again.';

/** Markers of text written for a developer rather than a user. */
const TECHNICAL = [
  /exception/i,
  /could not (execute|initialize|write|read)/i,
  /\bsql\b/i,
  /constraint/i,
  /\bproxy\b/i,
  /stack ?trace/i,
  /\bnull\b/i,
  /^[a-z]+\.[a-z]+\.[A-Za-z.]+/, // fully-qualified class names
  /request failed with status/i,
];

function looksTechnical(message) {
  return TECHNICAL.some((pattern) => pattern.test(message));
}

/**
 * @param {unknown} error an ApiError from `client.js`, or anything thrown
 * @param {string} [fallback] context-specific wording, e.g. "Could not load your bookings."
 */
export function toUserMessage(error, fallback) {
  const status = error?.status;
  const raw = typeof error?.message === 'string' ? error.message.trim() : '';

  if (status === 0 || error?.isNetworkError) {
    return 'Cannot reach TurfChai right now. Check your connection and try again.';
  }

  // Server-side faults never surface their detail: it is written for the log.
  if (status >= 500) {
    return BY_STATUS[status] ?? fallback ?? GENERIC;
  }

  // Anything thrown by the browser rather than by the API (a JSON parse fault,
  // a TypeError) carries no status and no wording meant for a person.
  if (status === undefined) {
    return fallback ?? GENERIC;
  }

  if (raw && !looksTechnical(raw) && raw.length <= 160) {
    return raw;
  }

  return BY_STATUS[status] ?? fallback ?? GENERIC;
}
