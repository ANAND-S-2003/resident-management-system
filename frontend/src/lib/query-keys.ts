export const queryKeys = {
  auth: ['auth'] as const,
  currentUser: ['auth', 'me'] as const,
  services: ['services'] as const,
  requests: ['requests'] as const,
  notifications: ['notifications'] as const,
  dashboard: ['dashboard'] as const,
  contactQueries: ['contact-queries'] as const,
};
