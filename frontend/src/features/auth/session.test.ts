import { describe, expect, it, vi } from "vitest";
import { clearStoredSession, readSession, writeSession } from "./session";

describe("session storage", () => {
  it("round-trips session data and tolerates corrupt or unavailable storage", () => {
    const session = {
      token: "token-value",
      expiresAt: "2099-01-01T00:00:00Z",
      user: {
        id: 1,
        fullName: "R",
        email: "r@example.test",
        role: "USER" as const,
        flatNumber: "A-1",
        active: true,
      },
    };
    writeSession(session);
    expect(readSession()).toEqual(session);
    window.sessionStorage.setItem("rms.session.v1", "{broken");
    expect(readSession()).toBeNull();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    expect(readSession()).toBeNull();
    clearStoredSession();
  });
});
