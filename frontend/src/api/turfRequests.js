import { api, apiGet, apiSend, apiUpload } from '@/api/client';

export function listTurfRequests(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return api(`/admin/turf-requests${query}`);
}

export function getTurfRequest(code) {
  return api(`/admin/turf-requests/${encodeURIComponent(code)}`);
}

export function reviewTurfRequest(code, action, note) {
  return api(`/admin/turf-requests/${encodeURIComponent(code)}/review`, {
    method: 'POST',
    body: { action, note },
  });
}

export async function createTurfRequest(payload) {
  return apiSend('POST', '/api/v1/turf-requests', payload);
}

export async function getMyTurfRequests() {
  return apiGet('/api/v1/turf-requests');
}

/**
 * Uploads a verification document (PDF or image).
 */
export async function recordTurfDocName(formData) {
  return apiUpload('/api/v1/turf-requests/upload', formData);
}

/** POST /api/v1/media/upload — a real upload; the returned URL resolves. */
export async function uploadTurfPhoto(formData) {
  return apiUpload('/api/v1/media/upload', formData);
}

