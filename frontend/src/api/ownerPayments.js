import { apiGet } from './client';

export async function fetchOwnerPayments(timeframe = 'daily') {
  return apiGet(`/api/v1/owner/payments?timeframe=${encodeURIComponent(timeframe)}`);
}
