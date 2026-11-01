package com.rms.resident.auth;

import com.rms.resident.common.enums.Role;
import com.rms.resident.user.UserAccount;

public record LoginUserResponse(Long id, String fullName, String email, Role role, String flatNumber) {
    public static LoginUserResponse from(UserAccount user) {
        return new LoginUserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getRole(), user.getFlatNumber());
    }
}
