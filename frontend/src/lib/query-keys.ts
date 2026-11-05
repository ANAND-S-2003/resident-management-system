export const queryKeys = {
  auth: ['auth'] as const,
  currentUser: ['auth', 'me'] as const,
  services: {
    all: ['services'] as const,
    lists: () => ['services', 'list'] as const,
    list: (params: unknown) => ['services', 'list', params] as const,
    details: () => ['services', 'detail'] as const,
    detail: (id: number) => ['services', 'detail', id] as const,
  },
  users: {
    all: ['users'] as const,
    lists: () => ['users', 'list'] as const,
    list: (params: unknown) => ['users', 'list', params] as const,
    details: () => ['users', 'detail'] as const,
    detail: (id: number) => ['users', 'detail', id] as const,
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
  staffRequests: {
    lists: () => ['requests', 'staff-list'] as const,
    list: (params: unknown) => ['requests', 'staff-list', params] as const,
    detail: (id: number) => ['requests', 'staff-detail', id] as const,
    history: (id: number) => ['requests', 'staff-history', id] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    lists: () => ['notifications', 'list'] as const,
    list: (params: unknown) => ['notifications', 'list', params] as const,
    unreadCount: ['notifications', 'unread-count'] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    summary: ['dashboard', 'summary'] as const,
  },
  contactQueries: {
    all: ['contact-queries'] as const,
    lists: () => ['contact-queries', 'list'] as const,
    list: (params: unknown) => ['contact-queries', 'list', params] as const,
    detail: (id: number) => ['contact-queries', 'detail', id] as const,
  },
};
