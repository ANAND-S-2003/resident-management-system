package com.rms.resident.user;

import com.rms.resident.common.enums.Role;
import java.time.Instant;

public record UserListItemResponse(Long id, String fullName, String email, Role role, String flatNumber,
                                   boolean active, Instant createdAt) {
    public static UserListItemResponse from(UserAccount u) {
        return new UserListItemResponse(u.getId(), u.getFullName(), u.getEmail(), u.getRole(), u.getFlatNumber(),
                u.isActive(), u.getCreatedAt());
    }
}
