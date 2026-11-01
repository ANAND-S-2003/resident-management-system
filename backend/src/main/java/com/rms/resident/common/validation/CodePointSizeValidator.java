package com.rms.resident.common.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;

public final class CodePointSizeValidator implements ConstraintValidator<CodePointSize, CharSequence> {
    private int min;
    private int max;
    @Override public void initialize(CodePointSize constraint) { min = constraint.min(); max = constraint.max(); }
    @Override public boolean isValid(CharSequence value, ConstraintValidatorContext context) {
        if (value == null) return true;
        int length = Character.codePointCount(value, 0, value.length());
        return length >= min && length <= max;
    }
}
