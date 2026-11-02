package com.rms.resident.request;

import com.rms.resident.common.enums.RequestStatus;

public final class RequestTransitionPolicy {
    private RequestTransitionPolicy() {}
    public static boolean allows(RequestStatus from, RequestStatus to) {
        return (from == RequestStatus.PENDING && (to == RequestStatus.IN_PROGRESS || to == RequestStatus.REJECTED))
                || (from == RequestStatus.IN_PROGRESS && (to == RequestStatus.COMPLETED || to == RequestStatus.REJECTED));
    }
}
