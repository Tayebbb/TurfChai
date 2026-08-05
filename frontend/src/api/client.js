/**
 * Unified REST client.
 *
 * Two call styles coexist during integration:
 *  - `api(path, options)` — auth-module style: paths relative to /api/v1,
 *    normalizes `message` error bodies, manages the JWT session.
 *  - `apiGet` / `apiSend` — discovery/profile/tournament style: absolute
 *    /api/v1/... paths against the backend origin, `error` bodies, URL params.
 * Both attach the bearer token when a session exists.
 */

const BACKEND_ORIGIN = import.meta.env.VITE_BACKEND_ORIGIN ?? 'http://localhost:8080';
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api/v1';

const TOKEN_KEY = 'turfchai.auth.token';
const USER_KEY = 'turfchai.auth.user';
const SESSION_EVENT = 'turfchai:session-change';

function notifySessionChange() {
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setSession({ token, user }) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  notifySessionChange();
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  notifySessionChange();
}

/**
 * Thin fetch wrapper: attaches the bearer token and normalizes error bodies.
 * Throws an Error with the backend `message` when the response is not OK.
 */
export async function api(path, { method = 'GET', body, token = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    const authToken = getToken();
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Network error — is the backend running?');
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.message) message = errorBody.message;
    } catch {
      // keep default message
    }
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) return null;
  const contentType = response.headers.get('content-type') ?? '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function authHeaders(extra = {}) {
  const headers = { Accept: 'application/json', ...extra };
  const authToken = getToken();
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

async function throwApiError(response) {
  let message = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    if (body?.error) message = body.error;
    else if (body?.message) message = body.message;
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(response.status, message);
}

/** GET with URL params against the backend origin (path includes /api/v1). */
export async function apiGet(path, params = {}) {
  const url = new URL(`${BACKEND_ORIGIN}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
    } else {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

/** Mutating request against the backend origin (path includes /api/v1). */
export async function apiSend(method, path, body) {
  const response = await fetch(`${BACKEND_ORIGIN}${path}`, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) await throwApiError(response);
  return response.status === 204 ? null : response.json();
}
