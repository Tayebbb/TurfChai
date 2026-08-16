import { api } from '@/api/client';

export function listAdminVenues(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return api(`/admin/venues${query}`);
}

export function getAdminVenue(id) {
  return api(`/admin/venues/${encodeURIComponent(id)}`);
}

/** 30-day trade and the 7-day demand trend for one venue. */
export function getAdminVenueAnalytics(id) {
  return api(`/admin/venues/${encodeURIComponent(id)}/analytics`);
}

export function updateVenueStatus(id, status) {
  return api(`/admin/venues/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}
