import { apiGet } from './client';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';

/** Code of the demo tournament seeded by the backend. */
export const DEMO_TOURNAMENT_CODE = 'TR-CUP-0091';

async function apiSend(method, path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.error) message = data.error;
    } catch {
      /* non-JSON body */
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.status === 204 ? null : response.json();
}

/** GET /api/v1/host/tournaments/{code} */
export function getTournament(code = DEMO_TOURNAMENT_CODE) {
  return apiGet(`/api/v1/host/tournaments/${encodeURIComponent(code)}`);
}

/** POST /{code}/multi-pitch-reserve — slots: [{pitchId, startTime, endTime, price}] */
export function reserveSlots(code, slots) {
  return apiSend('POST', `/api/v1/host/tournaments/${encodeURIComponent(code)}/multi-pitch-reserve`, {
    slots,
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
