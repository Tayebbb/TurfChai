import { apiGet } from './client';

export function getOwnerPaymentsLedger() {
  return apiGet('/api/v1/owner/payments/ledger');
}

export function getOwnerPaymentsChart(timeframe) {
  return apiGet(`/api/v1/owner/payments/chart?timeframe=${timeframe}`);
}

export function getOwnerPaymentsReports() {
  return apiGet('/api/v1/owner/payments/reports');
}
