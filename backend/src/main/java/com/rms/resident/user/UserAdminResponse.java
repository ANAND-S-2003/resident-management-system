package com.rms.resident.user;

import com.rms.resident.common.enums.Role;
import java.time.Instant;

public record UserAdminResponse(Long id, String fullName, String email, Role role, String flatNumber,
                                boolean active, Instant createdAt, Instant updatedAt) {
    public static UserAdminResponse from(UserAccount u) {
        return new UserAdminResponse(u.getId(), u.getFullName(), u.getEmail(), u.getRole(), u.getFlatNumber(),
                u.isActive(), u.getCreatedAt(), u.getUpdatedAt());
    }
}
