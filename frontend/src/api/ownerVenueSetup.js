import { apiGet } from './client';

export function getOwnerVenueSetup() {
  return apiGet('/api/v1/owner/venue-setup');
}
