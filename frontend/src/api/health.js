import { apiFetch } from './client';

/**
 * Perform a backend health check.
 * Endpoint: GET /api/v1/health
 */
export async function checkHealth() {
  return apiFetch('/api/v1/health');
}
