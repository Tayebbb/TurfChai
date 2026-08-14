import { apiGet } from './client';

export function getOwnerCustomers() {
  return apiGet('/api/v1/owner/customers');
}

