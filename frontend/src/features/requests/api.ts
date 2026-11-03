import { apiRequest } from '@/lib/api/client';
import type { NotificationItem, NotificationQuery, NotificationReadResponse, PageResponse, RequestCreateRequest, RequestHistoryEntry, RequestQuery, Service, ServiceRequest, ServiceQuery, ChangePasswordRequest } from '@/lib/api/types';

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  const value = search.toString();
  return value ? `?${value}` : '';
}

export const requestApi = {
  services: (params: ServiceQuery = {}) => apiRequest<PageResponse<Service>>(`/services${queryString(params as Record<string, string | number | boolean | undefined>)}`),
  requests: (params: RequestQuery = {}) => apiRequest<PageResponse<ServiceRequest>>(`/requests${queryString(params as Record<string, string | number | boolean | undefined>)}`),
  request: (id: number) => apiRequest<ServiceRequest>(`/requests/${encodeURIComponent(String(id))}`),
  history: (id: number) => apiRequest<RequestHistoryEntry[]>(`/requests/${encodeURIComponent(String(id))}/history`),
  createRequest: (body: RequestCreateRequest) => apiRequest<ServiceRequest>('/requests', { method: 'POST', body }),
  notifications: (params: NotificationQuery = {}) => apiRequest<PageResponse<NotificationItem>>(`/notifications${queryString(params as Record<string, string | number | boolean | undefined>)}`),
  unreadCount: () => apiRequest<{ count: number }>('/notifications/unread-count'),
  markNotificationRead: (id: number) => apiRequest<NotificationReadResponse>(`/notifications/${encodeURIComponent(String(id))}/read`, { method: 'PATCH', body: { read: true } }),
  markAllNotificationsRead: () => apiRequest<void>('/notifications/read-all', { method: 'PATCH' }),
  changePassword: (body: ChangePasswordRequest) => apiRequest<void>('/auth/change-password', { method: 'POST', body }),
};
