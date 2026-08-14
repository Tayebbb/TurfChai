import { apiGet } from './client';

export function getOwnerBookings() {
  return apiGet('/api/v1/owner/bookings');
}

export function getOwnerCalendar() {
  return apiGet('/api/v1/owner/calendar');
}

