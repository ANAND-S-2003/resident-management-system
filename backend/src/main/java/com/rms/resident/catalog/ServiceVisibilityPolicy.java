package com.rms.resident.catalog;

import com.rms.resident.common.enums.Role;
import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;

/** Keeps the USER active-only rule independent of caller-supplied filters. */
public final class ServiceVisibilityPolicy {
    private ServiceVisibilityPolicy() {}

    public static Boolean activeFilter(Role actor, String requested) {
        if (actor == Role.USER) return true;
        if (requested == null || requested.isBlank()) return null;
        String value = requested.trim();
        if ("true".equalsIgnoreCase(value)) return true;
        if ("false".equalsIgnoreCase(value)) return false;
        throw new ApiException(ErrorCode.VALIDATION_ERROR, "active must be true or false");
    }

    public static boolean mayView(Role actor, boolean active) {
        return actor != Role.USER || active;
    }
}
