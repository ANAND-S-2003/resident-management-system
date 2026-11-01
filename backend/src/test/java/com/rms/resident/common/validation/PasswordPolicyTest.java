package com.rms.resident.common.validation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PasswordPolicyTest {
    @Test void acceptsPasswordWithPolicyMinimums() { assertThat(PasswordPolicy.isValid("Abcdef1g")).isTrue(); }
    @Test void rejectsSevenCharacters() { assertThat(PasswordPolicy.isValid("Abcde1g")).isFalse(); }
    @Test void rejectsPasswordWithoutDigit() { assertThat(PasswordPolicy.isValid("Abcdefgh")).isFalse(); }
    @Test void rejectsPasswordWithoutLetter() { assertThat(PasswordPolicy.isValid("12345678")).isFalse(); }
    @Test void acceptsExactly72Utf8Bytes() { assertThat(PasswordPolicy.isValid("é".repeat(35) + "a1")).isTrue(); }
    @Test void rejects73Utf8Bytes() { assertThat(PasswordPolicy.isValid("é".repeat(35) + "a1x")).isFalse(); }
    @Test void rejectsMultibytePasswordWhenUtf8ByteLimitIsExceeded() { assertThat(PasswordPolicy.isValid("é".repeat(36) + "a1")).isFalse(); }
}
