import { apiGet } from '@/api/client';

/**
 * Match tickets (/api/v1/solo/tickets/**).
 *
 * The holder is taken from the bearer token, never from the request, so there
 * is no user id to pass. Responses are raw TicketResponse DTOs (no ApiResponse
 * envelope).
 *
 * Note: the backend also exposes POST /solo/tickets/check-in for a gate
 * scanner. TurfChai has no scanner screen — booking check-in is done from the
 * owner calendar instead — so no client is published for it here rather than
 * leaving an unused one lying around.
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
