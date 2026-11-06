import type { ApiErrorResponse, ErrorCode, FieldError } from "./types";
import { getCurrentToken } from "./session-token";
import { DEFAULT_API_BASE_URL } from "./config";
import { ERROR_CODES } from "@/lib/constants";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: FieldError[];
  readonly retryAfterSeconds: number | null;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    details: FieldError[] = [],
    retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

const apiBase = import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
let unauthorizedHandler: (() => void) | null = null;
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  unauthorizedHandler = handler;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers({ Accept: "application/json" });
  const token = options.token === undefined ? getCurrentToken() : options.token;
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const init: RequestInit = { method, headers, signal: options.signal };
  if (options.body !== undefined && method !== "GET" && method !== "HEAD") {
    headers.set("Content-Type", "application/json");
    init.body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(
      new URL(`${apiBase}${path}`, window.location.origin).toString(),
      init,
    );
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Unable to connect. Check your connection and try again.",
    );
  }
  const raw = await response.text();
  let data: unknown = null;
  if (raw) {
    try {
      data = JSON.parse(raw) as unknown;
    } catch {
      if (!response.ok)
        throw new ApiError(
          response.status,
          "UNKNOWN",
          "The server returned an unexpected response.",
          [],
          parseRetryAfter(response),
        );
      throw new ApiError(
        response.status,
        "UNKNOWN",
        "The server returned an unexpected response.",
      );
    }
  }
  if (!response.ok) {
    const error = (
      data && typeof data === "object" ? data : {}
    ) as Partial<ApiErrorResponse>;
    const known = new Set<ErrorCode>(ERROR_CODES);
    const code: ErrorCode =
      error.code && known.has(error.code) ? error.code : "UNKNOWN";
    if (response.status === 401 && code === "UNAUTHENTICATED" && token)
      unauthorizedHandler?.();
    throw new ApiError(
      response.status,
      code,
      safeMessage(code),
      Array.isArray(error.details) ? error.details : [],
      parseRetryAfter(response),
    );
  }
  if (response.status === 204 || !raw) return undefined as T;
  return data as T;
}

function parseRetryAfter(response: Response): number | null {
  const value = response.headers.get("Retry-After");
  if (!value) return null;
  const seconds = Number(value);
  return Number.isFinite(seconds) ? Math.max(0, seconds) : null;
}

function safeMessage(code: ErrorCode): string {
  if (code === "INVALID_CREDENTIALS") return "Invalid email or password.";
  if (code === "TOO_MANY_REQUESTS")
    return "Too many attempts. Please try again later.";
  if (code === "UNAUTHENTICATED")
    return "Your session has expired. Please sign in again.";
  if (code === "VALIDATION_ERROR")
    return "Please review the highlighted fields and try again.";
  if (code === "FORBIDDEN") return "You do not have permission to do that.";
  return "The request could not be completed.";
}
