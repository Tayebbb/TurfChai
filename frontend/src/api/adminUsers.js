import { api } from '@/api/client';

export function listAdminUsers(role, status, q, page = 0, size = 25) {
  const params = new URLSearchParams();
  if (role) params.set('role', role);
  if (status) params.set('status', status);
  if (q) params.set('q', q);
  params.set('page', String(page));
  params.set('size', String(size));
  return api(`/admin/users?${params.toString()}`);
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
