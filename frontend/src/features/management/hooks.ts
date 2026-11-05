import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { ContactQueryRequest, CreateServiceRequest, CreateUserRequest, ServiceQuery, SetActiveRequest, UpdateServiceRequest, UpdateUserRequest, UserQuery } from '@/lib/api/types';
import { managementApi } from './api';

export function useUsers(params: UserQuery) { return useQuery({ queryKey: queryKeys.users.list(params), queryFn: ({ signal }) => managementApi.users(params, signal) }); }
export function useUser(id: number, enabled = true) { return useQuery({ queryKey: queryKeys.users.detail(id), queryFn: ({ signal }) => managementApi.user(id, signal), enabled }); }
export function useServicesAdmin(params: ServiceQuery) { return useQuery({ queryKey: queryKeys.services.list(params), queryFn: ({ signal }) => managementApi.services(params, signal) }); }
export function useService(id: number, enabled = true) { return useQuery({ queryKey: queryKeys.services.detail(id), queryFn: ({ signal }) => managementApi.service(id, signal), enabled }); }
export function useContactQueries(params: { page: number; size: number; sort: string }) { return useQuery({ queryKey: queryKeys.contactQueries.list(params), queryFn: ({ signal }) => managementApi.contactQueries(params, signal) }); }
export function useContactQuery(id: number, enabled = true) { return useQuery({ queryKey: queryKeys.contactQueries.detail(id), queryFn: ({ signal }) => managementApi.contactQuery(id, signal), enabled }); }

export function useCreateUser() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: CreateUserRequest) => managementApi.createUser(body), onSuccess: async (user) => Promise.all([client.invalidateQueries({ queryKey: queryKeys.users.lists() }), client.invalidateQueries({ queryKey: queryKeys.users.detail(user.id) }), client.invalidateQueries({ queryKey: queryKeys.dashboard.summary })]) });
}
export function useUpdateUser(id: number) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: UpdateUserRequest) => managementApi.updateUser(id, body), onSuccess: async () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.users.lists() }), client.invalidateQueries({ queryKey: queryKeys.users.detail(id) }), client.invalidateQueries({ queryKey: queryKeys.dashboard.summary })]) });
}
export function useSetUserActive(id: number) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: SetActiveRequest) => managementApi.setUserActive(id, body), onSuccess: async () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.users.lists() }), client.invalidateQueries({ queryKey: queryKeys.users.detail(id) }), client.invalidateQueries({ queryKey: queryKeys.dashboard.summary })]) });
}
export function useCreateService() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: CreateServiceRequest) => managementApi.createService(body), onSuccess: async (service) => Promise.all([client.invalidateQueries({ queryKey: queryKeys.services.lists() }), client.invalidateQueries({ queryKey: queryKeys.services.detail(service.id) })]) });
}
export function useUpdateService(id: number) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: UpdateServiceRequest) => managementApi.updateService(id, body), onSuccess: async () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.services.lists() }), client.invalidateQueries({ queryKey: queryKeys.services.detail(id) })]) });
}
export function useSetServiceActive(id: number) {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: SetActiveRequest) => managementApi.setServiceActive(id, body), onSuccess: async () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.services.lists() }), client.invalidateQueries({ queryKey: queryKeys.services.detail(id) })]) });
}
export function useCreateContactQuery() { return useMutation({ mutationFn: (body: ContactQueryRequest) => managementApi.createContactQuery(body) }); }
