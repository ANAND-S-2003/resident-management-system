import { describe, expect, it } from "vitest";
import {
  formatDateOnly,
  formatTimestamp,
  getApplicationToday,
  parseDateOnly,
} from "./dates";

describe("date helpers", () => {
  it("parses and formats date-only values without UTC day shifts", () => {
    expect(parseDateOnly("2026-11-02")).toEqual({
      year: 2026,
      month: 11,
      day: 2,
    });
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(formatDateOnly("2026-11-02", "en-US")).toBe("November 2, 2026");
    expect(formatTimestamp("2026-11-01T20:00:00Z", "en-US")).toContain("2026");
  });

  it("uses Asia/Kolkata to derive the minimum date across UTC day boundaries", () => {
    expect(getApplicationToday(new Date("2026-11-01T20:00:00Z"))).toBe(
      "2026-11-02",
    );
    expect(getApplicationToday(new Date("2026-11-01T17:00:00Z"))).toBe(
      "2026-11-01",
    );
  });
});
