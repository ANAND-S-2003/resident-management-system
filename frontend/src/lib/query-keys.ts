export const queryKeys = {
  auth: ['auth'] as const,
  currentUser: ['auth', 'me'] as const,
  services: {
    all: ['services'] as const,
    lists: () => ['services', 'list'] as const,
    list: (params: unknown) => ['services', 'list', params] as const,
  },
  requests: {
    all: ['requests'] as const,
    lists: () => ['requests', 'list'] as const,
    list: (params: unknown) => ['requests', 'list', params] as const,
    details: () => ['requests', 'detail'] as const,
    detail: (id: number) => ['requests', 'detail', id] as const,
    histories: () => ['requests', 'history'] as const,
    history: (id: number, params?: unknown) => ['requests', 'history', id, params] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    lists: () => ['notifications', 'list'] as const,
    list: (params: unknown) => ['notifications', 'list', params] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  dashboard: ['dashboard'] as const,
  contactQueries: ['contact-queries'] as const,
};
