package com.rms.resident.user;

import com.rms.resident.common.enums.Role;
import com.rms.resident.common.validation.ValidPassword;
import com.rms.resident.common.validation.CodePointSize;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record UserCreateRequest(
        @NotBlank @CodePointSize(min = 2, max = 120) String fullName,
        @NotBlank @Email @CodePointSize(max = 254) String email,
        @NotBlank @ValidPassword String password,
        @NotNull Role role,
        @CodePointSize(min = 1, max = 30) String flatNumber) {
    public UserCreateRequest {
        fullName = trim(fullName); email = trim(email); flatNumber = trimNullable(flatNumber);
    }
    @AssertTrue(message = "flatNumber is required for USER and must be absent for ADMIN")
    public boolean isRoleFlatNumberCombinationValid() {
        return role == null || (role == Role.USER ? flatNumber != null : flatNumber == null);
    }
    private static String trim(String value) { return value == null ? null : value.trim(); }
    private static String trimNullable(String value) { return value == null ? null : value.trim(); }
}
