import { apiRequest } from '@/lib/api/client';
import type { DashboardSummary, NotificationItem, NotificationQuery, NotificationReadResponse, PageResponse, RequestCreateRequest, RequestHistoryEntry, RequestQuery, Service, ServiceRequest, ServiceQuery, ChangePasswordRequest, UpdateServiceRequestBody } from '@/lib/api/types';

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined) search.set(key, String(value));
  const value = search.toString();
  return value ? `?${value}` : '';
}

export const requestApi = {
  dashboardSummary: (signal?: AbortSignal) => apiRequest<DashboardSummary>('/dashboard/summary', { signal }),
  services: (params: ServiceQuery = {}, signal?: AbortSignal) => apiRequest<PageResponse<Service>>(`/services${queryString(params as Record<string, string | number | boolean | undefined>)}`, { signal }),
  requests: (params: RequestQuery = {}, signal?: AbortSignal) => apiRequest<PageResponse<ServiceRequest>>(`/requests${queryString(params as Record<string, string | number | boolean | undefined>)}`, { signal }),
  request: (id: number, signal?: AbortSignal) => apiRequest<ServiceRequest>(`/requests/${encodeURIComponent(String(id))}`, { signal }),
  updateRequest: (id: number, body: UpdateServiceRequestBody) => apiRequest<ServiceRequest>(`/requests/${encodeURIComponent(String(id))}`, { method: 'PATCH', body }),
  history: (id: number, signal?: AbortSignal) => apiRequest<RequestHistoryEntry[]>(`/requests/${encodeURIComponent(String(id))}/history`, { signal }),
  createRequest: (body: RequestCreateRequest) => apiRequest<ServiceRequest>('/requests', { method: 'POST', body }),
  notifications: (params: NotificationQuery = {}, signal?: AbortSignal) => apiRequest<PageResponse<NotificationItem>>(`/notifications${queryString(params as Record<string, string | number | boolean | undefined>)}`, { signal }),
  unreadCount: (signal?: AbortSignal) => apiRequest<{ count: number }>('/notifications/unread-count', { signal }),
  markNotificationRead: (id: number) => apiRequest<NotificationReadResponse>(`/notifications/${encodeURIComponent(String(id))}/read`, { method: 'PATCH', body: { read: true } }),
  markAllNotificationsRead: () => apiRequest<void>('/notifications/read-all', { method: 'PATCH' }),
  changePassword: (body: ChangePasswordRequest) => apiRequest<void>('/auth/change-password', { method: 'POST', body }),
};
