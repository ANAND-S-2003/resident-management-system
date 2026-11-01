package com.rms.resident.common.enums;

public enum Role {
    USER,
    ADMIN,
    SUPER_ADMIN;

    public static final String USER_AUTHORITY = "ROLE_USER";
    public static final String ADMIN_AUTHORITY = "ROLE_ADMIN";
    public static final String SUPER_ADMIN_AUTHORITY = "ROLE_SUPER_ADMIN";

    public String authority() {
        return switch (this) {
            case USER -> USER_AUTHORITY;
            case ADMIN -> ADMIN_AUTHORITY;
            case SUPER_ADMIN -> SUPER_ADMIN_AUTHORITY;
        };
    }
}
