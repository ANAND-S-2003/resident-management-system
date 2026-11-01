package com.rms.resident.user;

import com.rms.resident.common.enums.Role;

/** Pure authorization matrix for account administration. */
public final class UserAccessPolicy {
    public enum Operation { VIEW, CREATE, EDIT, ACTIVATE }

    public boolean may(Role actor, Role target, Operation operation) {
        if (actor == null || target == null || operation == null || target == Role.SUPER_ADMIN) return false;
        return switch (actor) {
            case USER -> false;
            case ADMIN -> target == Role.USER;
            case SUPER_ADMIN -> true;
        };
    }
}
