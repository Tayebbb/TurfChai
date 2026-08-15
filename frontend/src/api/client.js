/**
 * Unified REST client for TurfChai.
 *
 * Base URL is resolved from `import.meta.env.VITE_API_BASE_URL` or `import.meta.env.VITE_BACKEND_ORIGIN`.
 * In production (Vercel), points to https://turfchai.onrender.com
 * In local development, defaults to http://localhost:8080.
 */

const RAW_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_BACKEND_ORIGIN || '';
export const API_BASE_URL = RAW_BASE_URL ? RAW_BASE_URL.replace(/\/+$/, '') : (import.meta.env.DEV ? 'http://localhost:8080' : '');
const DEFAULT_PREFIX = import.meta.env.VITE_API_BASE ?? '/api/v1';

const TOKEN_KEY = 'turfchai.auth.token';
const USER_KEY = 'turfchai.auth.user';
const SESSION_EVENT = 'turfchai:session-change';

function notifySessionChange() {
  window.dispatchEvent(new CustomEvent(SESSION_EVENT));
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('turfchai_token') || localStorage.getItem('token');
}

export function setSession({ token, user }) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem('turfchai_token', token);
  }
  if (user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem('turfchai_user', JSON.stringify(user));
  }
  notifySessionChange();
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY) || localStorage.getItem('turfchai_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('turfchai_token');
  localStorage.removeItem('turfchai_user');
  notifySessionChange();
}

/**
 * A rejected token means the session is over, not that the page is off
 * limits: every player screen renders signed-out, so we clear the session
 * and let the UI fall back. Only the admin console, which has nothing to
 * show without an identity, is sent to its login.
 */
function handleUnauthorized() {
  clearSession();

  const onAdminRoute = window.location.pathname.startsWith('/admin');
  if (!onAdminRoute) return;
  if (window.location.pathname === '/admin/login') return;
  window.location.assign('/admin/login');
}

function resolveUrl(path) {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (API_BASE_URL) {
    if (cleanPath.startsWith('/api/')) {
      return `${API_BASE_URL}${cleanPath}`;
    }
    return `${API_BASE_URL}${DEFAULT_PREFIX}${cleanPath}`;
  }
  if (cleanPath.startsWith('/api/')) {
    return cleanPath;
  }
  return `${DEFAULT_PREFIX}${cleanPath}`;
}

/**
 * Same base-URL resolution the fetch helpers use, for callers that need the
 * URL rather than a request — `EventSource`, for one. Kept exported so no
 * caller re-derives the origin by hand; that duplication has broken LAN and
 * deployed builds before.
 */
export function apiUrl(path) {
  return resolveUrl(path);
}

/**
 * Fetch wrapper for API calls.
 */
export async function api(path, { method = 'GET', body, token = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    const authToken = getToken();
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    const user = getUser();
    if (user?.publicId || user?.id) {
      headers['X-User-Id'] = user.publicId || user.id;
    }
  }

  const url = resolveUrl(path);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Network error — is the backend running?');
  }

  if (!response.ok) {
    if (response.status === 401 && token) handleUnauthorized();

    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.validationErrors) {
        const details = Object.entries(errorBody.validationErrors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(', ');
        message = `${errorBody.message || 'Validation failed'}: ${details}`;
      } else if (errorBody?.message) {
        message = errorBody.message;
      } else if (errorBody?.error) {
        message = errorBody.error;
      }
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

/**
 * Alias for apiFetch used by openGames and lfgAlerts modules.
 */
export async function apiFetch(endpoint, options = {}) {
  return api(endpoint, {
    method: options.method || 'GET',
    body: options.body ? JSON.parse(options.body) : undefined,
    headers: options.headers,
  });
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
  if (response.status === 401 && getToken()) handleUnauthorized();

  let message = `Request failed (${response.status})`;
  try {
    const body = await response.json();
    if (body?.validationErrors) {
      const details = Object.entries(body.validationErrors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(', ');
      message = `${body.message || 'Validation failed'}: ${details}`;
    } else if (body?.error) {
      message = body.error;
    } else if (body?.message) {
      message = body.message;
    }
  } catch {
    /* non-JSON error body */
  }
  throw new ApiError(response.status, message);
}

/** GET with URL params against backend origin */
export async function apiGet(path, params = {}) {
  const fullUrlString = resolveUrl(path);
  const url = new URL(fullUrlString, window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
    } else {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url.toString(), { headers: authHeaders() });
  if (!response.ok) await throwApiError(response);
  return response.json();
}

/** Mutating request against backend origin */
export async function apiSend(method, path, body) {
  const url = resolveUrl(path);
  const response = await fetch(url, {
    method,
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!response.ok) await throwApiError(response);
  return response.status === 204 ? null : response.json();
}
