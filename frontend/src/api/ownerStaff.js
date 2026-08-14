import { apiGet } from './client';

export function getOwnerStaff() {
  return apiGet('/api/v1/owner/staff');
}

export function getOwnerStaffAuditLog() {
  return apiGet('/api/v1/owner/staff/audit-log');
}

