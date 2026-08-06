import { api } from '@/api/client';

export function submitReview(payload) {
  return api('/reviews', { method: 'POST', body: payload });
}

export function checkIn(bookingId) {
  return api(`/matchday/checkin?bookingId=${encodeURIComponent(bookingId)}`, { method: 'POST' });
}
