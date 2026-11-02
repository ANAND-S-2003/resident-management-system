package com.rms.resident.contact;

import jakarta.validation.Validation;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class ContactDtosTest {
    private final varHolder validatorHolder=new varHolder();
    private static class varHolder { final jakarta.validation.Validator validator=Validation.buildDefaultValidatorFactory().getValidator(); }
    @Test void trimsLowercasesAndAcceptsValuesWithinCodePointLimits() {
        var value=new ContactDtos.CreateRequest("  😀A  "," USER@Example.test ","  Help!  ","  <script>"+"x".repeat(5)+"</script>  ");
        assertThat(validatorHolder.validator.validate(value)).isEmpty();
        assertThat(value.name()).isEqualTo("😀A"); assertThat(value.email()).isEqualTo("user@example.test");
    }
    @Test void rejectsBlankInvalidEmailAndCodePointOverlimits() {
        assertThat(validatorHolder.validator.validate(new ContactDtos.CreateRequest(" ","bad","x","x"))).isNotEmpty();
        assertThat(validatorHolder.validator.validate(new ContactDtos.CreateRequest("😀".repeat(121),"x@example.test","Subject","Message text"))).isNotEmpty();
        assertThat(validatorHolder.validator.validate(new ContactDtos.CreateRequest("Valid Name","x@example.test","😀".repeat(201),"Message text"))).isNotEmpty();
        assertThat(validatorHolder.validator.validate(new ContactDtos.CreateRequest("Valid Name","x@example.test","Subject","😀".repeat(2001)))).isNotEmpty();
    }
    @Test void acceptsDocumentedUpperBoundariesByUnicodeCodePoint() {
        String longestEmail="u".repeat(64)+"@"+"a".repeat(63)+"."+"b".repeat(63)+"."+"c".repeat(61);
        var value=new ContactDtos.CreateRequest("😀".repeat(120),longestEmail,"S".repeat(200),"M".repeat(2000));
        assertThat(longestEmail.codePointCount(0,longestEmail.length())).isEqualTo(254);
        assertThat(validatorHolder.validator.validate(value)).isEmpty();
    }
}
