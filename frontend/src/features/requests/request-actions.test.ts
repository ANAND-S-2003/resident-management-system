import { describe, expect, it } from "vitest";
import { REQUEST_STATUSES } from "@/lib/constants";
import { requestActions } from "./request-actions";

describe("requestActions", () => {
  it("exposes only the allowed actions and their UI requirements for each status", () => {
    expect(requestActions(REQUEST_STATUSES[0])).toEqual([
      {
        label: "Start work",
        status: REQUEST_STATUSES[1],
        requiresRemarks: false,
        needsConfirmation: false,
      },
      {
        label: "Reject",
        status: REQUEST_STATUSES[3],
        requiresRemarks: true,
        needsConfirmation: true,
      },
    ]);
    expect(requestActions(REQUEST_STATUSES[1])).toEqual([
      {
        label: "Mark completed",
        status: REQUEST_STATUSES[2],
        requiresRemarks: false,
        needsConfirmation: true,
      },
      {
        label: "Reject",
        status: REQUEST_STATUSES[3],
        requiresRemarks: true,
        needsConfirmation: true,
      },
    ]);
    expect(requestActions(REQUEST_STATUSES[2])).toEqual([]);
    expect(requestActions(REQUEST_STATUSES[3])).toEqual([]);
  });
});
