import { apiGet, apiSend } from './client';

/** GET /api/v1/host/tournaments — the tournaments the caller hosts. */
export function getMyHostedTournaments() {
  return apiGet('/api/v1/host/tournaments');
}

/** GET /api/v1/host/tournaments/{code} */
export function getTournament(code) {
  return apiGet(`/api/v1/host/tournaments/${encodeURIComponent(code)}`);
}

/** GET /api/v1/tournaments */
export function browseTournaments(params = {}) {
  return apiGet('/api/v1/tournaments', params);
}

/** POST /{code}/multi-pitch-reserve — slots: [{pitchId, startTime, endTime}] (priced server-side) */
export function reserveSlots(code, slots, repeatWeeks) {
  return apiSend('POST', `/api/v1/host/tournaments/${encodeURIComponent(code)}/multi-pitch-reserve`, {
    slots,
    repeatWeeks,
  });
}

/**
 * GET /{code}/reserve-quote?repeatWeeks= — live price for repeating the
 * reserved pattern weekly. Writes nothing, so it is safe to call on every
 * change of the recurrence selector.
 */
export function quoteReservation(code, repeatWeeks) {
  return apiGet(`/api/v1/host/tournaments/${encodeURIComponent(code)}/reserve-quote`, {
    repeatWeeks,
  });
}

/**
 * POST /{code}/deposit — confirms the bulk reservation and captures the
 * deposit. The amount is computed server-side; only the method and the
 * payer's reference travel from the browser.
 */
export function payDeposit(code, { repeatWeeks, method, payerReference }) {
  return apiSend('POST', `/api/v1/host/tournaments/${encodeURIComponent(code)}/deposit`, {
    repeatWeeks,
    method,
    payerReference,
  });
}

/** POST /{code}/teams */
export function registerTeam(code, name, captainName) {
  return apiSend('POST', `/api/v1/host/tournaments/${encodeURIComponent(code)}/teams`, {
    name,
    captainName,
  });
}

/** POST /{code}/fixtures/generate */
export function generateFixtures(code) {
  return apiSend('POST', `/api/v1/host/tournaments/${encodeURIComponent(code)}/fixtures/generate`);
}

/**
 * POST /{code}/balance — settles the remainder after the deposit. As with the
 * deposit, the amount is computed server-side.
 */
export function payBalance(code, { method, payerReference } = {}) {
  return apiSend('POST', `/api/v1/host/tournaments/${encodeURIComponent(code)}/balance`, {
    method: method || 'bKash',
    payerReference,
  });
}

/** PATCH /{code}/settings — listing privacy and private event-day notes. */
export function updateTournamentSettings(code, settings) {
  return apiSend('PATCH', `/api/v1/host/tournaments/${encodeURIComponent(code)}/settings`, settings);
}

/** POST /{code}/invite-code — issues a new invite code, invalidating the old link. */
export function regenerateInviteCode(code) {
  return apiSend('POST', `/api/v1/host/tournaments/${encodeURIComponent(code)}/invite-code`);
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

export const bdt = (value) => `৳${Math.round(Number(value)).toLocaleString('en-IN')}`;

/** '08:00' or '08:00:00' -> '8:00 AM' */
export function formatTime(time) {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** '2027-08-21' -> 'Sat 21 Aug' */
export function formatDate(isoDate) {
  if (!isoDate) return '';
  const date = new Date(`${isoDate}T00:00:00`);
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
