import { describe, expect, it } from "vitest";
import { ROLES, type Role } from "@/lib/constants";
import { mayManageUser, type UserOperation } from "./user-policy";

describe("mayManageUser", () => {
  it("covers actor, target, and operation matrix", () => {
    const operations: UserOperation[] = [
      "view",
      "edit",
      "activate",
      "deactivate",
    ];
    const expected: Record<Role, Record<Role, boolean>> = {
      USER: { USER: false, ADMIN: false, SUPER_ADMIN: false },
      ADMIN: { USER: true, ADMIN: false, SUPER_ADMIN: false },
      SUPER_ADMIN: { USER: true, ADMIN: true, SUPER_ADMIN: false },
    };
    for (const actor of ROLES)
      for (const target of ROLES)
        for (const operation of operations) {
          expect(
            mayManageUser(actor, target, operation),
            `${actor} ${operation} ${target}`,
          ).toBe(expected[actor][target]);
        }
  });

  it("never offers self deactivation", () => {
    expect(mayManageUser("ADMIN", "USER", "deactivate", 7, 7)).toBe(false);
    expect(mayManageUser("SUPER_ADMIN", "ADMIN", "deactivate", 7, 7)).toBe(
      false,
    );
    expect(mayManageUser("ADMIN", "USER", "activate", 7, 7)).toBe(true);
  });
});
