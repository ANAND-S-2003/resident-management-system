package com.rms.resident.auth;

import com.rms.resident.common.enums.Role;
import com.rms.resident.user.UserAccount;

public record UserResponse(Long id, String fullName, String email, Role role, String flatNumber, boolean active) {
    public static UserResponse from(UserAccount user) {
        return new UserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getRole(),
                user.getFlatNumber(), user.isActive());
    }
}
