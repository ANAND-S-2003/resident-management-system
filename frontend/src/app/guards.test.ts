import { describe, expect, it } from "vitest";
import { canAccessPath, homeForRole } from "./guards";
import { ROLES } from "@/lib/constants";

describe("role route access", () => {
  it("sends each role to its role home", () => {
    expect(homeForRole(ROLES[0])).toBe("/resident");
    expect(homeForRole(ROLES[1])).toBe("/admin");
    expect(homeForRole(ROLES[2])).toBe("/admin");
  });
  it("limits staff, resident and super-admin routes to documented roles", () => {
    expect(canAccessPath(ROLES[0], "/resident/requests")).toBe(true);
    expect(canAccessPath(ROLES[0], "/admin")).toBe(false);
    expect(canAccessPath(ROLES[1], "/admin/requests")).toBe(true);
    expect(canAccessPath(ROLES[1], "/admin/admins")).toBe(false);
    expect(canAccessPath(ROLES[2], "/admin/admins")).toBe(true);
    for (const role of ROLES)
      expect(canAccessPath(role, "/account")).toBe(true);
  });
});
