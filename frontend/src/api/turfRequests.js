import { api } from '@/api/client';

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
