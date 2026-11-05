import { apiRequest } from '@/lib/api/client';
import type { ContactQueryCreated, ContactQueryDto, ContactQueryRequest, CreateServiceRequest, CreateUserRequest, PageResponse, Service, ServiceQuery, SetActiveRequest, UpdateServiceRequest, UpdateUserRequest, UserQuery, UserSummary } from '@/lib/api/types';

function queryString(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value !== undefined) search.set(key, String(value)); });
  const value = search.toString();
  return value ? `?${value}` : '';
}

export const managementApi = {
  users: (params: UserQuery, signal?: AbortSignal) => apiRequest<PageResponse<UserSummary>>(`/users${queryString(params as Record<string, string | number | boolean | undefined>)}`, { signal }),
  user: (id: number, signal?: AbortSignal) => apiRequest<UserSummary>(`/users/${encodeURIComponent(String(id))}`, { signal }),
  createUser: (body: CreateUserRequest) => apiRequest<UserSummary>('/users', { method: 'POST', body }),
  updateUser: (id: number, body: UpdateUserRequest) => apiRequest<UserSummary>(`/users/${encodeURIComponent(String(id))}`, { method: 'PUT', body }),
  setUserActive: (id: number, body: SetActiveRequest) => apiRequest<UserSummary>(`/users/${encodeURIComponent(String(id))}/activation`, { method: 'PATCH', body }),
  services: (params: ServiceQuery, signal?: AbortSignal) => apiRequest<PageResponse<Service>>(`/services${queryString(params as Record<string, string | number | boolean | undefined>)}`, { signal }),
  service: (id: number, signal?: AbortSignal) => apiRequest<Service>(`/services/${encodeURIComponent(String(id))}`, { signal }),
  createService: (body: CreateServiceRequest) => apiRequest<Service>('/services', { method: 'POST', body }),
  updateService: (id: number, body: UpdateServiceRequest) => apiRequest<Service>(`/services/${encodeURIComponent(String(id))}`, { method: 'PUT', body }),
  setServiceActive: (id: number, body: SetActiveRequest) => apiRequest<Service>(`/services/${encodeURIComponent(String(id))}/activation`, { method: 'PATCH', body }),
  contactQueries: (params: { page?: number; size?: number; sort?: string }, signal?: AbortSignal) => apiRequest<PageResponse<ContactQueryDto>>(`/contact-queries${queryString(params)}`, { signal }),
  contactQuery: (id: number, signal?: AbortSignal) => apiRequest<ContactQueryDto>(`/contact-queries/${encodeURIComponent(String(id))}`, { signal }),
  createContactQuery: (body: ContactQueryRequest) => apiRequest<ContactQueryCreated>('/contact-queries', { method: 'POST', body }),
};
