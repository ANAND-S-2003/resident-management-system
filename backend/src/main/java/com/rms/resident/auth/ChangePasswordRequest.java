package com.rms.resident.auth;

import com.rms.resident.common.validation.ValidPassword;
import jakarta.validation.constraints.NotBlank;

public record ChangePasswordRequest(@NotBlank String currentPassword, @ValidPassword String newPassword) {
    @Override
    public String toString() { return "ChangePasswordRequest[currentPassword=[REDACTED], newPassword=[REDACTED]]"; }
}
