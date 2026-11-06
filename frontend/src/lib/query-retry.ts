import { ApiError } from "./api/client";

/** Retry transient failures once, but never repeat a client-side 4xx response. */
export function shouldRetryQuery(
  failureCount: number,
  error: unknown,
): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500)
    return false;
  return failureCount < 1;
}
