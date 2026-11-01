package com.rms.resident.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import static org.assertj.core.api.Assertions.assertThat;

class RmsPropertiesTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
            .withUserConfiguration(PropertiesConfiguration.class);

    @Test
    void acceptsValidConfigurationAndDefaultsTimezone() {
        runner.withPropertyValues(validProperties()).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(RmsProperties.class).timezone()).isEqualTo("Asia/Kolkata");
            assertThat(context.getBean(RmsProperties.class).trustProxy()).isFalse();
        });
    }

    @Test
    void failsWhenJwtSecretIsMissing() {
        runner.withPropertyValues(without(validProperties(), "rms.jwt-secret=01234567890123456789012345678901"))
                .run(context -> assertFailureMentions(context, "RMS_JWT_SECRET"));
    }

    @Test
    void failsWhenJwtSecretIsShorterThan32Bytes() {
        runner.withPropertyValues(replace(validProperties(), "rms.jwt-secret=01234567890123456789012345678901", "rms.jwt-secret=short"))
                .run(context -> assertFailureMentions(context, "32 UTF-8 bytes"));
    }

    @Test
    void failsForInvalidTimezone() {
        runner.withPropertyValues(replace(validProperties(), "rms.timezone=Asia/Kolkata", "rms.timezone=Not/A_Real_Zone"))
                .run(context -> assertFailureMentions(context, "valid ZoneId"));
    }

    @Test
    void failsWhenSuperadminEmailIsMissing() {
        runner.withPropertyValues(without(validProperties(), "rms.superadmin-email=superadmin@example.test"))
                .run(context -> assertFailureMentions(context, "RMS_SUPERADMIN_EMAIL"));
    }

    private static String[] validProperties() {
        return new String[]{
                "rms.jwt-secret=01234567890123456789012345678901",
                "rms.superadmin-email=superadmin@example.test",
                "rms.superadmin-name=Test Super Admin",
                "rms.superadmin-password=Replace123",
                "rms.cors-allowed-origins=http://localhost:5173"
        };
    }

    private static String[] replace(String[] source, String oldValue, String newValue) {
        return java.util.Arrays.stream(source).map(value -> value.equals(oldValue) ? newValue : value).toArray(String[]::new);
    }

    private static String[] without(String[] source, String value) {
        return java.util.Arrays.stream(source).filter(item -> !item.equals(value)).toArray(String[]::new);
    }

    private static void assertFailureMentions(org.springframework.boot.test.context.assertj.AssertableApplicationContext context, String expected) {
        assertThat(context).hasFailed();
        Throwable failure = context.getStartupFailure();
        String messages = failure.toString();
        while (failure.getCause() != null) {
            failure = failure.getCause();
            messages += " " + failure;
        }
        assertThat(messages).contains(expected);
    }

    @Configuration(proxyBeanMethods = false)
    @EnableConfigurationProperties(RmsProperties.class)
    static class PropertiesConfiguration {}
}

