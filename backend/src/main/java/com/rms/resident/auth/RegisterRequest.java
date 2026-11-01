package com.rms.resident.auth;

import com.rms.resident.common.validation.ValidPassword;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.util.Locale;

public record RegisterRequest(
        @NotBlank @Size(min = 2, max = 120) String fullName,
        @NotBlank @Email @Size(max = 254) String email,
        @ValidPassword String password,
        @NotBlank @Size(min = 1, max = 30) String flatNumber
) {
    public RegisterRequest {
        fullName = fullName == null ? null : fullName.trim();
        email = email == null ? null : email.trim().toLowerCase(Locale.ROOT);
        flatNumber = flatNumber == null ? null : flatNumber.trim();
    }

    @Override
    public String toString() {
        return "RegisterRequest[fullName=" + fullName + ", email=" + email + ", password=[REDACTED], flatNumber=" + flatNumber + "]";
    }
}
