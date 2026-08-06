import { api } from '@/api/client';

/**
 * Admin-scoped login helpers. The admin console requires a two-factor step:
 * `adminLogin` validates credentials and returns a challenge (plus the code in
 * demo mode), `adminVerifyLogin` exchanges challenge + code for the JWT.
 */

/** Step 1 — credentials. Returns { challenge, sentTo, ttlSeconds, devCode?, message }. */
export function adminLogin(payload) {
  return api('/admin/auth/login', { method: 'POST', body: payload, token: false });
}

/** Step 2 — verify the one-time code. Returns { token, user }. */
export function adminVerifyLogin(payload) {
  return api('/admin/auth/login/verify', { method: 'POST', body: payload, token: false });
}

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

export function getAnalyticsGrowth() {
  return api('/admin/analytics/growth');
}

export function getAnalyticsRevenue() {
  return api('/admin/analytics/revenue');
}

export function getAnalyticsSegments() {
  return api('/admin/analytics/segments');
}
