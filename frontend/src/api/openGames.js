import { apiGet, apiSend } from '@/api/client';

/**
 * Solo "open games" endpoints (/api/v1/solo/open-games/**).
 *
 * Responses are the raw OpenGameResponse / OpenGameMemberResponse DTOs — this
 * controller does not use the ApiResponse envelope, so there is no `.data` to
 * unwrap. Reads are public; `joinOpenGame` and `createOpenGame` need a
 * signed-in role and take the acting user's id in the body (they do not read
 * it from the JWT).
 */

const BASE = '/api/v1/solo/open-games';

/**
 * GET /solo/open-games — the feed, with the three server-side filters.
 * @param {{ skillLevel?: string, gameDate?: string, query?: string }} filters
 *   `skillLevel` is a SkillLevel name (BEGINNER | INTERMEDIATE | ADVANCED |
 *   ALL_LEVELS), `gameDate` an ISO date ("2026-08-08"). Blank values are
 *   dropped by `apiGet`, so passing `{}` returns everything.
 * @returns {Promise<Array>} OpenGameResponse[]
 */
export function searchOpenGames({ skillLevel, gameDate, query } = {}) {
  return apiGet(BASE, { skillLevel, gameDate, query });
}

/** GET /solo/open-games/{id} — one game, `members` included. */
export function getOpenGame(id) {
  return apiGet(`${BASE}/${encodeURIComponent(id)}`);
}

/** GET /solo/open-games/{id}/members — the roster with reliability scores. */
export function getOpenGameMembers(id) {
  return apiGet(`${BASE}/${encodeURIComponent(id)}/members`);
}

/**
 * POST /solo/open-games/{id}/join — claims a spot for `userId`.
 * Rejects with 4xx when the game is full, already joined, or the user's
 * reliability / skill level does not clear the game's bar; the thrown
 * ApiError carries the backend message.
 * @returns {Promise<object>} JoinOpenGameResponse
 */
export function joinOpenGame(id, { userId, paymentMethod }) {
  return apiSend('POST', `${BASE}/${encodeURIComponent(id)}/join`, { userId, paymentMethod });
}

/** POST /solo/open-games — creates a game (201). `organizerUserId` is required. */
export function createOpenGame(request) {
  return apiSend('POST', BASE, request);
}

/* ── Display helpers ────────────────────────────────────────────────────────
 * The wire format for these DTOs is Java LocalDate/LocalTime ("2026-08-08",
 * "21:00:00"), which is not directly renderable. These live next to the client
 * so the four solo screens format an OpenGameResponse identically.
 */

/** SkillLevel enum name → the label the UI shows. */
export const SKILL_LABELS = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
  ALL_LEVELS: 'All levels',
};

/** `"INTERMEDIATE"` → `"Intermediate"`, unknown/missing → `"All levels"`. */
export function skillLabel(skillLevel) {
  return SKILL_LABELS[skillLevel] ?? SKILL_LABELS.ALL_LEVELS;
}

/** `"21:00:00"` → `"9:00 PM"`. */
export function formatTime(time) {
  if (!time) return '';
  const [rawHour, rawMinute] = String(time).split(':');
  const hour24 = Number(rawHour);
  if (Number.isNaN(hour24)) return '';
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour}:${(rawMinute ?? '00').padStart(2, '0')} ${period}`;
}

/**
 * `("21:00:00", "22:30:00")` → `"9:00–10:30 PM"`; the meridiem is only
 * repeated when the range crosses noon/midnight.
 */
export function formatTimeRange(start, end) {
  const from = formatTime(start);
  if (!from) return '';
  const to = formatTime(end);
  if (!to) return from;
  const [fromClock, fromPeriod] = from.split(' ');
  const [, toPeriod] = to.split(' ');
  return fromPeriod === toPeriod ? `${fromClock}–${to}` : `${from}–${to}`;
}

/** Local ISO date `offset` days from today, e.g. `isoDay(1)` → tomorrow. */
export function isoDay(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** `"2026-08-08"` → `"Today"` / `"Tomorrow"` / `"Sat 8 Aug"`. */
export function formatGameDay(gameDate) {
  if (!gameDate) return '';
  if (gameDate === isoDay(0)) return 'Today';
  if (gameDate === isoDay(1)) return 'Tomorrow';
  const date = new Date(`${gameDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return gameDate;
  return date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

/** Epoch millis of kickoff, used for "soonest first" sorting. */
export function kickoffMs(game) {
  const stamp = new Date(`${game?.gameDate}T${game?.startTime ?? '00:00:00'}`).getTime();
  return Number.isNaN(stamp) ? Number.POSITIVE_INFINITY : stamp;
}
