import { api } from '@/api/client';

export function getNotifications() {
  return api('/notifications');
}

export function getUnreadCount() {
  return api('/notifications/unread-count');
}

export function markRead(id) {
  return api(`/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
}

export function markAllRead() {
  return api('/notifications/read-all', { method: 'POST' });
}
