import { api, apiGet, apiSend } from '@/api/client';

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

export async function uploadTurfDoc(formData) {
  return apiSend('POST', '/api/v1/turf-requests/upload', formData);
}
