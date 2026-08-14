import { apiGet, apiSend } from '@/api/client';

/**
 * Match tickets (/api/v1/solo/tickets/**).
 *
 * The holder is taken from the bearer token, never from the request, so there
 * is no user id to pass. Responses are raw TicketResponse / CheckInResponse
 * DTOs (no ApiResponse envelope).
 */

const BASE = '/api/v1/solo/tickets';

/**
 * GET /solo/tickets/{gameId} — the signed-in player's pass for one open game.
 * Rejects with 403 when the caller is not on that game's roster.
 * @returns {Promise<object>} TicketResponse, including `checkInToken`
 */
export function getTicket(gameId) {
  return apiGet(`${BASE}/${encodeURIComponent(gameId)}`);
}

/** POST /solo/tickets/check-in — gate scanner; HOST/OWNER/ADMIN only. */
export function checkInTicket(token) {
  return apiSend('POST', `${BASE}/check-in`, { token });
}
