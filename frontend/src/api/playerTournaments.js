import { apiGet, apiSend } from './client';

/**
 * Player-facing tournament browse + registration.
 * Host-side tournament management lives in `./tournaments`.
 */

/** GET /api/v1/tournaments */
export function browseTournaments(params = {}) {
  return apiGet('/api/v1/tournaments', params);
}

/** GET /api/v1/tournaments/me — the player's own registrations. */
export function getMyTournaments() {
  return apiGet('/api/v1/tournaments/me');
}

/** GET /api/v1/tournaments/{code} */
export function getTournamentDetail(code) {
  return apiGet(`/api/v1/tournaments/${encodeURIComponent(code)}`);
}

/** POST /api/v1/tournaments/{code}/register */
export function registerForTournament(code, registration) {
  return apiSend('POST', `/api/v1/tournaments/${encodeURIComponent(code)}/register`, registration);
}

/** DELETE /api/v1/tournaments/{code}/register */
export function withdrawFromTournament(code) {
  return apiSend('DELETE', `/api/v1/tournaments/${encodeURIComponent(code)}/register`);
}

/**
 * Registration state drives every CTA, so it is derived in one place.
 * Returns { key, label, tone, actionable }.
 */
export function registrationState(card) {
  if (!card) return { key: 'unknown', label: 'Unavailable', tone: 'gray', actionable: false };
  if (card.myRegistrationCode) {
    return card.myPaymentStatus === 'PAID'
      ? { key: 'paid', label: 'Registered', tone: 'green', actionable: true }
      : { key: 'pending', label: 'Payment due', tone: 'amber', actionable: true };
  }
  if (card.status !== 'PUBLISHED' && card.status !== 'CONFIRMED') {
    return { key: 'closed', label: 'Registration closed', tone: 'gray', actionable: false };
  }
  if (card.spotsLeft <= 0) {
    return { key: 'full', label: 'Tournament full', tone: 'red', actionable: false };
  }
  return { key: 'open', label: `${card.spotsLeft} spots left`, tone: 'green', actionable: true };
}
