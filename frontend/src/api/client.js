/**
 * Centralized API Client for TurfChai
 *
 * Base URL is configured using `import.meta.env.VITE_API_BASE_URL`.
 * In production (Vercel), VITE_API_BASE_URL points to https://turfchai.onrender.com
 * In local development, if VITE_API_BASE_URL is not set, it defaults to http://localhost:8080.
 */

const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;
  if (envUrl && envUrl.trim() !== '') {
    return envUrl.trim().replace(/\/+$/, '');
  }
  return import.meta.env.DEV ? 'http://localhost:8080' : '';
};

export const API_BASE_URL = getApiBaseUrl();

/**
 * Perform an API HTTP request to the backend.
 *
 * @param {string} endpoint - API path e.g. '/api/v1/solo/open-games'
 * @param {RequestInit} [options] - Fetch request options
 * @returns {Promise<any>} Response JSON data
 */
export async function apiFetch(endpoint, options = {}) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url =
    endpoint.startsWith('http://') || endpoint.startsWith('https://')
      ? endpoint
      : `${API_BASE_URL}${cleanEndpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers || {}),
  };

  const token = localStorage.getItem('turfchai_token') || localStorage.getItem('token');
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const response = await fetch(url, config);

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorData = await response.json();
      if (errorData.message) {
        errorMessage = errorData.message;
      }
    } catch {
      // Ignore JSON parse errors on error response body
    }
    const error = new Error(errorMessage);
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return null;
  }

  return await response.json();
}
