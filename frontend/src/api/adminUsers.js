import { api } from '@/api/client';

export function listAdminUsers(role, status, q) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  const query = params.toString() ? `?${params.toString()}` : '';
  return api(`/admin/users${query}`);
}

export function updateUserStatus(id, payload) {
  return api(`/admin/users/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: payload,
  });
}

export function reinstateUser(id) {
  return api(`/admin/users/${encodeURIComponent(id)}/reinstate`, {
    method: 'POST',
  });
}
