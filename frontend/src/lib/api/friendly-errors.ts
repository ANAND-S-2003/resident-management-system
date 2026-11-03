import { ApiError } from './client';

export function friendlyErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (!(error instanceof ApiError)) return fallback;
  switch (error.code) {
    case 'VALIDATION_ERROR': return 'Please review the highlighted fields and try again.';
    case 'NOT_FOUND': return 'We could not find that item.';
    case 'FORBIDDEN': return 'You do not have permission to view this information.';
    case 'TOO_MANY_REQUESTS': return `Please wait ${error.retryAfterSeconds ?? 60} seconds before trying again.`;
    case 'NETWORK_ERROR': return 'Unable to connect. Check your connection and try again.';
    case 'UNKNOWN': return 'The server returned an unexpected response.';
    default: return fallback;
  }
}

export function apiFieldErrors(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError)) return {};
  return Object.fromEntries(error.details.map(({ field, message }) => [field, message]));
}
