package com.rms.resident.common.config;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Size;
import com.rms.resident.common.validation.PasswordPolicy;
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
        @DefaultValue("false") boolean trustProxy,
        @DefaultValue("5") @Min(value = 1, message = "RMS_RATE_LIMIT_LOGIN_MAX must be between 1 and 10000") @Max(value = 10000, message = "RMS_RATE_LIMIT_LOGIN_MAX must be between 1 and 10000") int rateLimitLoginMax,
        @DefaultValue("10") @Min(value = 1, message = "RMS_RATE_LIMIT_REGISTER_MAX must be between 1 and 10000") @Max(value = 10000, message = "RMS_RATE_LIMIT_REGISTER_MAX must be between 1 and 10000") int rateLimitRegisterMax,
        @DefaultValue("5") @Min(value = 1, message = "RMS_RATE_LIMIT_CONTACT_MAX must be between 1 and 10000") @Max(value = 10000, message = "RMS_RATE_LIMIT_CONTACT_MAX must be between 1 and 10000") int rateLimitContactMax
) {
    public RmsProperties {
        if (superadminEmail != null) superadminEmail = superadminEmail.trim().toLowerCase(java.util.Locale.ROOT);
        if (superadminName != null) superadminName = superadminName.trim();
        if (timezone != null) timezone = timezone.trim();
        if (timezone == null || timezone.isBlank()) {
            throw new IllegalArgumentException("RMS_TIMEZONE must be a valid time zone (ZoneId)");
        }
        try {
            ZoneId.of(timezone);
        } catch (RuntimeException ex) {
            throw new IllegalArgumentException("RMS_TIMEZONE must be a valid time zone (ZoneId): " + timezone, ex);
        }
        corsAllowedOrigins = corsAllowedOrigins == null ? List.of() : corsAllowedOrigins.stream()
                .filter(origin -> origin != null && !origin.isBlank())
                .map(String::trim)
                .toList();
        if (corsAllowedOrigins.contains("*")) {
            throw new IllegalArgumentException("RMS_CORS_ALLOWED_ORIGINS must list explicit origins; wildcard is not allowed");
        }
    }

    @AssertTrue(message = "RMS_JWT_SECRET must be at least 32 UTF-8 bytes")
    public boolean isJwtSecretAtLeast32Bytes() {
        return jwtSecret != null && jwtSecret.getBytes(StandardCharsets.UTF_8).length >= 32;
    }

    @AssertTrue(message = "RMS_SUPERADMIN_PASSWORD must meet the documented password policy")
    public boolean isSuperadminPasswordValid() {
        return PasswordPolicy.isValid(superadminPassword);
    }

    @Override
    public String toString() {
        return "RmsProperties[jwtSecret=[REDACTED], superadminEmail=" + superadminEmail
                + ", superadminName=" + superadminName + ", superadminPassword=[REDACTED], timezone="
                + timezone + ", corsAllowedOrigins=" + corsAllowedOrigins + ", trustProxy=" + trustProxy + "]";
    }
}

