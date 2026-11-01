package com.rms.resident.user;

import com.rms.resident.common.validation.CodePointSize;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record UserUpdateRequest(@NotBlank @CodePointSize(min = 2, max = 120) String fullName,
                                @NotBlank @Email @CodePointSize(max = 254) String email,
                                @CodePointSize(min = 1, max = 30) String flatNumber) {
    public UserUpdateRequest { fullName = trim(fullName); email = trim(email); flatNumber = trim(flatNumber); }
    private static String trim(String value) { return value == null ? null : value.trim(); }
}
