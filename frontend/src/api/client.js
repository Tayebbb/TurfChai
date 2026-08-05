/**
 * Minimal REST client for the Spring Boot backend.
 * Base URL is injected at build time via VITE_API_BASE (defaults to the
 * local backend) so deployments can point elsewhere without code changes.
 */
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8080';

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function apiGet(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((item) => url.searchParams.append(key, item));
    } else {
      url.searchParams.set(key, value);
    }
  });

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, message);
  }
  return response.json();
}
