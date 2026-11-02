export const ROLES = ['USER', 'ADMIN', 'SUPER_ADMIN'] as const;
export type Role = (typeof ROLES)[number];
export const REQUEST_STATUSES = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const NOTIFICATION_TYPES = ['REQUEST_STATUS_CHANGED'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export const ERROR_CODES = ['VALIDATION_ERROR', 'INVALID_CURRENT_PASSWORD', 'UNAUTHENTICATED', 'INVALID_CREDENTIALS', 'FORBIDDEN', 'NOT_FOUND', 'METHOD_NOT_ALLOWED', 'DUPLICATE_RESOURCE', 'INVALID_STATUS_TRANSITION', 'CONCURRENT_MODIFICATION', 'TOO_MANY_REQUESTS', 'INTERNAL_ERROR', 'NETWORK_ERROR', 'UNKNOWN'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
