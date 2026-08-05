import { api } from '@/api/client';

/** List all admin accounts (ADMIN or SUPER_ADMIN only). */
export function listAdmins() {
  return api('/admin/admins');
}

/** Appoint a new admin (SUPER_ADMIN only). */
export function appointAdmin(payload) {
  return api('/admin/admins', { method: 'POST', body: payload });
}

/** Update an admin's granular permissions (SUPER_ADMIN only). */
export function updateAdminPermissions(adminId, permissions) {
  return api(`/admin/admins/${adminId}/permissions`, { method: 'PATCH', body: { permissions } });
}

/** Deactivate an admin account (SUPER_ADMIN only). */
export function deactivateAdmin(adminId) {
  return api(`/admin/admins/${adminId}/deactivate`, { method: 'POST' });
}
