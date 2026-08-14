import { apiGet } from './client';

export function getOwnerAnalytics() {
  return apiGet('/api/v1/owner/analytics/dashboard');
}
