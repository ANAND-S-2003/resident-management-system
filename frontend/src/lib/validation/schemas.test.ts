import { describe, expect, it } from "vitest";
import {
  emailSchema,
  flatNumberSchema,
  fullNameSchema,
  PASSWORD_MESSAGE,
  passwordSchema,
  registerSchema,
} from "./schemas";

describe("shared validation schemas", () => {
  it("trims strings and counts code points for field limits", () => {
    expect(fullNameSchema.parse("  😀😀  ")).toBe("😀😀");
    expect(flatNumberSchema.parse(" A-1 ")).toBe("A-1");
    expect(fullNameSchema.safeParse("😀".repeat(121)).success).toBe(false);
  });
  it("enforces password characters, Unicode bytes and byte maximum", () => {
    for (const value of [
      "Short1",
      "Password",
      "12345678",
      "a".repeat(71) + "1A",
      "😀".repeat(18) + "A1",
    ]) {
      const result = passwordSchema.safeParse(value);
      expect(result.success).toBe(false);
      if (!result.success)
        expect(result.error.issues[0]?.message).toBe(PASSWORD_MESSAGE);
    }
    expect(passwordSchema.safeParse("a".repeat(70) + "1A").success).toBe(true);
  });
  it("validates email and password confirmation", () => {
    expect(emailSchema.safeParse("not-an-email").success).toBe(false);
    expect(
      emailSchema.safeParse(`${"a".repeat(243)}@example.test`).success,
    ).toBe(false);
    expect(
      registerSchema.safeParse({
        fullName: "Resident",
        email: "r@example.test",
        flatNumber: "1",
        password: "Password1",
        confirmPassword: "Different1",
      }).success,
    ).toBe(false);
  });
});
