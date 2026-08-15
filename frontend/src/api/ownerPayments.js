import { apiGet, apiSend } from './client';

export async function fetchOwnerPayments(timeframe = 'daily') {
  return apiGet(`/api/v1/owner/payments?timeframe=${encodeURIComponent(timeframe)}`);
}

export async function closeOwnerShift() {
  return apiSend('POST', '/api/v1/owner/payments/close-shift');
}

export function getInvoiceUrl(payoutCode = 'SETTLE-2026-08') {
  return `/api/v1/owner/payments/invoices/${payoutCode}`;
}

export function getCsvExportUrl() {
  return `/api/v1/owner/payments/export`;
}
