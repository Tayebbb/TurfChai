import { api } from '@/api/client';

export function listPayouts(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return api(`/admin/payouts${query}`);
}

/** Settled/pending/flagged totals, so the dashboard need not fetch every row. */
export function getPayoutSummary() {
  return api('/admin/payouts/summary');
}

export function getPayout(code) {
  return api(`/admin/payouts/${encodeURIComponent(code)}`);
}

export function settlePayout(code) {
  return api(`/admin/payouts/${encodeURIComponent(code)}/settle`, {
    method: 'POST',
  });
}

export function flagPayout(code, reason) {
  return api(`/admin/payouts/${encodeURIComponent(code)}/flag`, {
    method: 'POST',
    body: { reason },
  });
}
