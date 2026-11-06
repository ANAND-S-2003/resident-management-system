import { REQUEST_STATUSES } from "@/lib/constants";
import type { RequestStatus } from "@/lib/api/types";

export interface RequestAction {
  label: string;
  status: RequestStatus;
  requiresRemarks: boolean;
  needsConfirmation: boolean;
}

/** UI affordances mirror the backend workflow; every transition is still validated by the API. */
export function requestActions(status: RequestStatus): RequestAction[] {
  if (status === REQUEST_STATUSES[0])
    return [
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
    ];
  if (status === REQUEST_STATUSES[1])
    return [
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
    ];
  return [];
}
