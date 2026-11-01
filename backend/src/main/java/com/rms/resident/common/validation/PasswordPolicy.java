package com.rms.resident.common.validation;

import java.nio.charset.StandardCharsets;

public final class PasswordPolicy {
    public static final String MESSAGE = "Password must be at least 8 characters, no more than 72 UTF-8 bytes, and include at least one letter and one digit.";

    private PasswordPolicy() {}

    public static boolean isValid(String value) {
        if (value == null || value.codePointCount(0, value.length()) < 8
                || value.getBytes(StandardCharsets.UTF_8).length > 72) {
            return false;
        }
        boolean letter = false;
        boolean digit = false;
        for (int index = 0; index < value.length();) {
            int codePoint = value.codePointAt(index);
            letter |= Character.isLetter(codePoint);
            digit |= Character.isDigit(codePoint);
            index += Character.charCount(codePoint);
        }
        return letter && digit;
    }
}
