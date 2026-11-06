import { describe, expect, it } from "vitest";
import { notificationsLabel } from "./notifications-label";

describe("notificationsLabel", () => {
  it("returns Notifications without a count when none are unread", () => {
    expect(notificationsLabel(0)).toBe("Notifications");
  });

  it("formats positive counts with a comma immediately after Notifications", () => {
    expect(notificationsLabel(1)).toBe("Notifications, 1 unread");
    expect(notificationsLabel(14)).toBe("Notifications, 14 unread");
  });
});
