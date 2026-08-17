/**
 * Unified REST client for TurfChai.
 *
 * Base URL is resolved from `import.meta.env.VITE_API_BASE_URL` or `import.meta.env.VITE_BACKEND_ORIGIN`.
 * In production (Vercel), points to https://turfchai.onrender.com
 * In local development, defaults to http://localhost:8080.
 */
import { toUserMessage } from '@/utils/errorMessage';

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
    const offline = new ApiError(0, 'Cannot reach TurfChai right now. Check your connection and try again.');
    offline.isNetworkError = true;
    throw offline;
  }

  if (!response.ok) {
    if (response.status === 401 && token) handleUnauthorized();

    // `detail` keeps whatever the server said for logging; `message` is the
    // line a user may see, so it never carries transport or server internals.
    let detail = '';
    let validationErrors = null;
    try {
      const errorBody = await response.json();
      validationErrors = errorBody?.validationErrors ?? null;
      if (validationErrors) {
        detail = Object.entries(validationErrors)
          .map(([field, msg]) => `${field}: ${msg}`)
          .join(', ');
      } else {
        detail = errorBody?.message || errorBody?.error || '';
      }
    } catch {
      // No JSON body — the status alone has to carry the meaning.
    }

    const error = new ApiError(response.status, detail);
    error.detail = detail;
    error.validationErrors = validationErrors;
    error.message = toUserMessage(error);
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
  if (response.status === 401 && getToken()) handleUnauthorized();

  let detail = '';
  let validationErrors = null;
  try {
    const body = await response.json();
    validationErrors = body?.validationErrors ?? null;
    if (validationErrors) {
      detail = Object.entries(validationErrors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(', ');
    } else {
      detail = body?.message || body?.error || '';
    }
  } catch {
    /* non-JSON error body */
  }

  const error = new ApiError(response.status, detail);
  error.detail = detail;
  error.validationErrors = validationErrors;
  error.message = toUserMessage(error);
  throw error;
}

/**
 * Reads a successful response body without assuming it is JSON.
 *
 * Several endpoints answer 200 with an empty body (`ResponseEntity<Void>`), and
 * `response.json()` on those throws a parser error that surfaces to the user as
 * a failure even though the call succeeded.
 */
async function readBody(response) {
  if (response.status === 204 || response.status === 205) return null;
  const text = await response.text();
  if (!text) return null;
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('json')) return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
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
  return readBody(response);
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
  return readBody(response);
}

/** Multipart FormData upload request against backend origin */
export async function apiUpload(path, formData) {
  const url = resolveUrl(path);
  const headers = authHeaders(); // omit Content-Type so browser sets boundary
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData,
  });
  if (!response.ok) await throwApiError(response);
  return readBody(response);
}

/**
 * GET request against backend origin that returns a binary body (a PDF, an
 * image) rather than JSON/text. `readBody` assumes a text/JSON payload, so a
 * download needs its own reader — everything else (auth header, error
 * handling) matches apiGet.
 */
export async function apiDownload(path) {
  const url = resolveUrl(path);
  const response = await fetch(url, { headers: authHeaders() });
  if (!response.ok) await throwApiError(response);
  return response.blob();
}
