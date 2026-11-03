import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { NotificationItem, NotificationQuery, RequestCreateRequest, RequestQuery, ServiceQuery, ChangePasswordRequest } from '@/lib/api/types';
import { requestApi } from './api';

export function useServices(params: ServiceQuery = {}) {
  return useQuery({ queryKey: queryKeys.services.list(params), queryFn: () => requestApi.services(params) });
}

export function useRequests(params: RequestQuery = {}) {
  return useQuery({ queryKey: queryKeys.requests.list(params), queryFn: () => requestApi.requests(params) });
}

export function useRequest(id: number, enabled = true) {
  return useQuery({ queryKey: queryKeys.requests.detail(id), queryFn: () => requestApi.request(id), enabled });
}

export function useRequestHistory(id: number, enabled = true) {
  return useQuery({ queryKey: queryKeys.requests.history(id), queryFn: () => requestApi.history(id), enabled });
}

export function useNotifications(params: NotificationQuery = {}) {
  return useQuery({ queryKey: queryKeys.notifications.list(params), queryFn: () => requestApi.notifications(params) });
}

export function useUnreadCount(enabled = true) {
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: requestApi.unreadCount,
    enabled,
    refetchInterval: () => document.visibilityState === 'visible' ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useCreateRequest() {
  const client = useQueryClient();
  return useMutation({ mutationFn: (body: RequestCreateRequest) => requestApi.createRequest(body), onSuccess: async () => {
    await Promise.all([client.invalidateQueries({ queryKey: queryKeys.requests.lists() }), client.invalidateQueries({ queryKey: queryKeys.dashboard })]);
  } });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => requestApi.markNotificationRead(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: queryKeys.notifications.lists() });
      const previous = client.getQueriesData({ queryKey: queryKeys.notifications.lists() });
      const wasUnread = previous.some(([, value]) => isUnread(value, id));
      client.setQueriesData({ queryKey: queryKeys.notifications.lists() }, (current: unknown) => updateNotificationPage(current, id, true));
      if (wasUnread) client.setQueryData(queryKeys.notifications.unreadCount, (count: { count: number } | undefined) => count ? { count: Math.max(0, count.count - 1) } : count);
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, value]) => client.setQueryData<unknown>(key, value));
      void client.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    },
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.notifications.lists() }), client.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })]),
  });
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: requestApi.markAllNotificationsRead,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: queryKeys.notifications.lists() });
      const previous = client.getQueriesData({ queryKey: queryKeys.notifications.lists() });
      client.setQueriesData({ queryKey: queryKeys.notifications.lists() }, (current: unknown) => updateNotificationPage(current, null, true));
      client.setQueryData(queryKeys.notifications.unreadCount, { count: 0 });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, value]) => client.setQueryData<unknown>(key, value));
      void client.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
    },
    onSettled: () => Promise.all([client.invalidateQueries({ queryKey: queryKeys.notifications.lists() }), client.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount })]),
  });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (body: ChangePasswordRequest) => requestApi.changePassword(body) });
}

function isUnread(current: unknown, id: number): boolean {
  return Boolean(current && typeof current === 'object' && 'content' in current && Array.isArray(current.content) && current.content.some((item) => item && typeof item === 'object' && 'id' in item && item.id === id && 'read' in item && item.read === false));
}

function updateNotificationPage(current: unknown, id: number | null, read: boolean): unknown {
  if (!current || typeof current !== 'object' || !('content' in current) || !Array.isArray(current.content)) return current;
  const page = current as { content: NotificationItem[]; [key: string]: unknown };
  return { ...page, content: page.content.map((item) => id === null || item.id === id ? { ...item, read, readAt: read ? item.readAt ?? new Date().toISOString() : null } : item) };
}
