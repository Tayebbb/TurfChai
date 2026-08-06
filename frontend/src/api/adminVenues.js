import { api } from '@/api/client';

export function listAdminVenues(status) {
  const query = status ? `?status=${encodeURIComponent(status)}` : '';
  return api(`/admin/venues${query}`);
}

export function getAdminVenue(id) {
  return api(`/admin/venues/${encodeURIComponent(id)}`);
}

export function updateVenueStatus(id, status) {
  return api(`/admin/venues/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  });
}
