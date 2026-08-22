import { apiGet, apiSend } from './client';

export function getOwnerCustomers() {
  return apiGet('/api/v1/owner/customers');
}

export function updateCustomerNote(customerId, note) {
  return apiSend('PUT', `/api/v1/owner/customers/${customerId}/note`, { note });
}

export function rewardCustomer(customerId) {
  return apiSend('POST', `/api/v1/owner/customers/${customerId}/reward`, {});
}

export function rewardRegularCustomers() {
  return apiSend('POST', '/api/v1/owner/customers/reward-regulars', {});
}
