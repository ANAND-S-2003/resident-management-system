import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type {
  NotificationItem,
  NotificationQuery,
  RequestCreateRequest,
  RequestQuery,
  ServiceQuery,
  ChangePasswordRequest,
  UpdateServiceRequestBody,
} from "@/lib/api/types";
import { requestApi } from "./api";
import { useIsAuthenticated } from "@/features/auth/AuthProvider";

export function useServices(params: ServiceQuery = {}) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.services.list(params),
    queryFn: ({ signal }) => requestApi.services(params, signal),
    enabled: authenticated,
  });
}

export function useRequests(params: RequestQuery = {}) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.requests.list(params),
    queryFn: ({ signal }) => requestApi.requests(params, signal),
    enabled: authenticated,
  });
}

export function useRequest(id: number, enabled = true) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.requests.detail(id),
    queryFn: ({ signal }) => requestApi.request(id, signal),
    enabled: enabled && authenticated,
  });
}

export function useRequestHistory(id: number, enabled = true) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.requests.history(id),
    queryFn: ({ signal }) => requestApi.history(id, signal),
    enabled: enabled && authenticated,
  });
}

export function useDashboardSummary() {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.dashboard.summary,
    queryFn: ({ signal }) => requestApi.dashboardSummary(signal),
    enabled: authenticated,
    refetchOnWindowFocus: true,
  });
}

export function useStaffRequests(params: RequestQuery = {}) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.staffRequests.list(params),
    queryFn: ({ signal }) => requestApi.requests(params, signal),
    enabled: authenticated,
    refetchOnWindowFocus: true,
  });
}

export function useStaffRequest(id: number, enabled = true) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.staffRequests.detail(id),
    queryFn: ({ signal }) => requestApi.request(id, signal),
    enabled: enabled && authenticated,
    refetchOnWindowFocus: true,
  });
}

export function useStaffRequestHistory(id: number, enabled = true) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.staffRequests.history(id),
    queryFn: ({ signal }) => requestApi.history(id, signal),
    enabled: enabled && authenticated,
    refetchOnWindowFocus: true,
  });
}

export function useUpdateStaffRequest(id: number) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateServiceRequestBody) =>
      requestApi.updateRequest(id, body),
    onSuccess: async (_data, body) => {
      const invalidations = [
        client.invalidateQueries({
          queryKey: queryKeys.staffRequests.detail(id),
        }),
      ];
      if (body.status !== undefined)
        invalidations.push(
          client.invalidateQueries({
            queryKey: queryKeys.staffRequests.history(id),
          }),
          client.invalidateQueries({
            queryKey: queryKeys.staffRequests.lists(),
          }),
          client.invalidateQueries({ queryKey: queryKeys.requests.lists() }),
          client.invalidateQueries({ queryKey: queryKeys.requests.detail(id) }),
          client.invalidateQueries({
            queryKey: queryKeys.requests.history(id),
          }),
          client.invalidateQueries({ queryKey: queryKeys.dashboard.summary }),
        );
      await Promise.all(invalidations);
    },
  });
}

export function useNotifications(params: NotificationQuery = {}) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: ({ signal }) => requestApi.notifications(params, signal),
    enabled: authenticated,
  });
}

export function useUnreadCount(enabled = true) {
  const authenticated = useIsAuthenticated();
  return useQuery({
    queryKey: queryKeys.notifications.unreadCount,
    queryFn: ({ signal }) => requestApi.unreadCount(signal),
    enabled: enabled && authenticated,
    refetchInterval: () =>
      document.visibilityState === "visible" ? 60_000 : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });
}

export function useCreateRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: RequestCreateRequest) => requestApi.createRequest(body),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.requests.lists() }),
        client.invalidateQueries({ queryKey: queryKeys.dashboard.all }),
      ]);
    },
  });
}

export function useMarkNotificationRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => requestApi.markNotificationRead(id),
    onMutate: async (id) => {
      await client.cancelQueries({ queryKey: queryKeys.notifications.lists() });
      const previous = client.getQueriesData({
        queryKey: queryKeys.notifications.lists(),
      });
      const wasUnread = previous.some(([, value]) => isUnread(value, id));
      client.setQueriesData(
        { queryKey: queryKeys.notifications.lists() },
        (current: unknown) => updateNotificationPage(current, id, true),
      );
      if (wasUnread)
        client.setQueryData(
          queryKeys.notifications.unreadCount,
          (count: { count: number } | undefined) =>
            count ? { count: Math.max(0, count.count - 1) } : count,
        );
      return { previous };
    },
    onError: (_error, _id, context) => {
      context?.previous.forEach(([key, value]) =>
        client.setQueryData<unknown>(key, value),
      );
      void client.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount,
      });
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.notifications.lists() }),
        client.invalidateQueries({
          queryKey: queryKeys.notifications.unreadCount,
        }),
      ]),
  });
}

export function useMarkAllNotificationsRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: requestApi.markAllNotificationsRead,
    onMutate: async () => {
      await client.cancelQueries({ queryKey: queryKeys.notifications.lists() });
      const previous = client.getQueriesData({
        queryKey: queryKeys.notifications.lists(),
      });
      client.setQueriesData(
        { queryKey: queryKeys.notifications.lists() },
        (current: unknown) => updateNotificationPage(current, null, true),
      );
      client.setQueryData(queryKeys.notifications.unreadCount, { count: 0 });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      context?.previous.forEach(([key, value]) =>
        client.setQueryData<unknown>(key, value),
      );
      void client.invalidateQueries({
        queryKey: queryKeys.notifications.unreadCount,
      });
    },
    onSettled: () =>
      Promise.all([
        client.invalidateQueries({ queryKey: queryKeys.notifications.lists() }),
        client.invalidateQueries({
          queryKey: queryKeys.notifications.unreadCount,
        }),
      ]),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) =>
      requestApi.changePassword(body),
  });
}

function isUnread(current: unknown, id: number): boolean {
  return Boolean(
    current &&
      typeof current === "object" &&
      "content" in current &&
      Array.isArray(current.content) &&
      current.content.some(
        (item) =>
          item &&
          typeof item === "object" &&
          "id" in item &&
          item.id === id &&
          "read" in item &&
          item.read === false,
      ),
  );
}

function updateNotificationPage(
  current: unknown,
  id: number | null,
  read: boolean,
): unknown {
  if (
    !current ||
    typeof current !== "object" ||
    !("content" in current) ||
    !Array.isArray(current.content)
  )
    return current;
  const page = current as {
    content: NotificationItem[];
    [key: string]: unknown;
  };
  return {
    ...page,
    content: page.content.map((item) =>
      id === null || item.id === id
        ? {
            ...item,
            read,
            readAt: read ? (item.readAt ?? new Date().toISOString()) : null,
          }
        : item,
    ),
  };
}
