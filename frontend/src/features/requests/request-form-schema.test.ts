import { describe, expect, it } from "vitest";
import { requestFormSchema } from "./request-form-schema";

describe("request form schema", () => {
  const schema = requestFormSchema("2026-11-02");
  it("requires a service, description and expected date, and rejects past dates", () => {
    expect(
      schema.safeParse({
        serviceId: "",
        description: "long enough",
        expectedCompletionDate: "",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        serviceId: "1",
        description: "okay",
        expectedCompletionDate: "2026-11-01",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        serviceId: "1",
        description: "valid description",
        expectedCompletionDate: "2026-11-02",
      }).success,
    ).toBe(true);
  });
  it("counts description limits in Unicode code points and trims before validation", () => {
    expect(
      schema.safeParse({
        serviceId: "1",
        description: " 😀😀😀😀😀 ",
        expectedCompletionDate: "2026-11-02",
      }).success,
    ).toBe(true);
    expect(
      schema.safeParse({
        serviceId: "1",
        description: " 😀😀😀 ",
        expectedCompletionDate: "2026-11-02",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        serviceId: "1",
        description: "x".repeat(1001),
        expectedCompletionDate: "2026-11-02",
      }).success,
    ).toBe(false);
  });
});
