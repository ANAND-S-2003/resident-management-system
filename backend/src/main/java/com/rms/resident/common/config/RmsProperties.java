package com.rms.resident.common.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

import java.nio.charset.StandardCharsets;
import java.time.ZoneId;
import java.util.List;

@Validated
@ConfigurationProperties(prefix = "rms")
public record RmsProperties(
        @NotBlank(message = "RMS_JWT_SECRET is required") String jwtSecret,
        @NotBlank(message = "RMS_SUPERADMIN_EMAIL is required") @Email(message = "RMS_SUPERADMIN_EMAIL must be a valid email") @Size(max = 254) String superadminEmail,
        @NotBlank(message = "RMS_SUPERADMIN_NAME is required") @Size(min = 2, max = 120) String superadminName,
        @NotBlank(message = "RMS_SUPERADMIN_PASSWORD is required") String superadminPassword,
        @DefaultValue("Asia/Kolkata") String timezone,
        @DefaultValue List<String> corsAllowedOrigins,
        @DefaultValue("false") boolean trustProxy
) {
    public RmsProperties {
        if (superadminEmail != null) superadminEmail = superadminEmail.trim().toLowerCase(java.util.Locale.ROOT);
        if (superadminName != null) superadminName = superadminName.trim();
        if (timezone != null) timezone = timezone.trim();
        corsAllowedOrigins = corsAllowedOrigins == null ? List.of() : corsAllowedOrigins.stream()
                .filter(origin -> origin != null && !origin.isBlank())
                .map(String::trim)
                .toList();
    }

    @AssertTrue(message = "RMS_JWT_SECRET must be at least 32 UTF-8 bytes")
    public boolean isJwtSecretAtLeast32Bytes() {
        return jwtSecret != null && jwtSecret.getBytes(StandardCharsets.UTF_8).length >= 32;
    }

    @AssertTrue(message = "RMS_TIMEZONE must be a valid ZoneId")
    public boolean isTimezoneValid() {
        if (timezone == null || timezone.isBlank()) return false;
        try {
            ZoneId.of(timezone);
            return true;
        } catch (RuntimeException ex) {
            return false;
        }
    }

    @AssertTrue(message = "RMS_SUPERADMIN_PASSWORD must meet the documented password policy")
    public boolean isSuperadminPasswordValid() {
        if (superadminPassword == null) return false;
        int bytes = superadminPassword.getBytes(StandardCharsets.UTF_8).length;
        return superadminPassword.codePointCount(0, superadminPassword.length()) >= 8 && bytes <= 72
                && superadminPassword.matches("(?s).*\\p{L}.*")
                && superadminPassword.matches("(?s).*\\p{N}.*");
    }
}

