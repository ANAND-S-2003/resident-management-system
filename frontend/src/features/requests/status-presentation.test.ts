import { describe, expect, it } from "vitest";
import { presentRequestStatus } from "./status-presentation";

describe("request status presentation", () => {
  it.each([
    ["PENDING", "Pending", "warning"],
    ["IN_PROGRESS", "In progress", "info"],
    ["COMPLETED", "Completed", "success"],
    ["REJECTED", "Rejected", "danger"],
  ] as const)("presents %s with its label and tone", (status, label, tone) => {
    expect(presentRequestStatus(status, false)).toEqual({
      label,
      tone,
      accessibleText: label,
    });
    expect(presentRequestStatus(status, true)).toEqual({
      label,
      tone,
      accessibleText: `${label}, Overdue`,
      overdueLabel: "Overdue",
    });
  });
});
