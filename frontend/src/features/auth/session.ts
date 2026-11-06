import type { UserSummary } from "@/lib/api/types";

const SESSION_KEY = "rms.session.v1";
export interface AuthSession {
  token: string;
  expiresAt: string;
  user: UserSummary;
}

export function readSession(): AuthSession | null {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return null;
    const session = value as Partial<AuthSession>;
    if (
      typeof session.token !== "string" ||
      typeof session.expiresAt !== "string" ||
      !session.user ||
      typeof session.user !== "object"
    )
      return null;
    return session as AuthSession;
  } catch {
    return null;
  }
}

export function writeSession(session: AuthSession): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* Storage can be disabled by browser policy. */
  }
}

export function clearStoredSession(): void {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* Storage can be disabled by browser policy. */
  }
}
