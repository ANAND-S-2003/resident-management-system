package com.rms.resident.user;

import com.rms.resident.common.enums.Role;
import com.rms.resident.catalog.ServiceWriteRequest;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class UserRequestValidationTest {
    private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();
    @Test void validatesUserAndAdminFlatNumberRoleCombinationsAndLimits() {
        assertThat(validator.validate(new UserCreateRequest("R", "r@example.test", "Resident123", Role.USER, "1"))).isNotEmpty();
        assertThat(validator.validate(new UserCreateRequest("Resident", "r@example.test", "Resident123", Role.USER, null))).isNotEmpty();
        assertThat(validator.validate(new UserCreateRequest("Resident", "r@example.test", "Resident123", Role.ADMIN, "A-1"))).isNotEmpty();
        assertThat(validator.validate(new UserCreateRequest("Resident", "r@example.test", "Resident123", Role.ADMIN, null))).isEmpty();
        assertThat(validator.validate(new UserCreateRequest("R".repeat(121), "r@example.test", "Resident123", Role.USER, "1"))).isNotEmpty();
        assertThat(validator.validate(new UserCreateRequest("N".repeat(120), "r@example.test", "Resident123", Role.USER, "1".repeat(30)))).isEmpty();
        assertThat(validator.validate(new UserCreateRequest("😀😀", "r@example.test", "Resident123", Role.USER, "1"))).isEmpty();
        assertThat(validator.validate(new UserCreateRequest("Resident", "r".repeat(246) + "@example.test", "Resident123", Role.USER, "1"))).isNotEmpty();
        assertThat(validator.validate(new UserCreateRequest("Resident", "not-email", "Resident123", Role.USER, "1"))).isNotEmpty();
        assertThat(validator.validate(new UserCreateRequest("Resident", "r@example.test", "Resident123", Role.USER, "x".repeat(31)))).isNotEmpty();
        assertThat(validator.validate(new UserCreateRequest("Resident", "r@example.test", "Resident123", Role.USER, ""))).isNotEmpty();
    }
    @Test void validatesServiceFieldLimitsAfterTrimming() {
        assertThat(validator.validate(new ServiceWriteRequest(" P ", null))).isNotEmpty();
        assertThat(validator.validate(new ServiceWriteRequest(" Plumbing ", " D ".repeat(168)))).isNotEmpty();
        assertThat(validator.validate(new ServiceWriteRequest("  Plumbing  ", "  ok  "))).isEmpty();
        assertThat(validator.validate(new ServiceWriteRequest("😀😀", null))).isEmpty();
        assertThat(validator.validate(new ServiceWriteRequest("S".repeat(100), "D".repeat(500)))).isEmpty();
        assertThat(validator.validate(new ServiceWriteRequest("S".repeat(101), "D".repeat(500)))).isNotEmpty();
    }
}
