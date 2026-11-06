package com.rms.resident.common.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.autoconfigure.AutoConfigurations;
import org.springframework.boot.autoconfigure.validation.ValidationAutoConfiguration;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Import;
import com.rms.resident.common.time.ClockConfiguration;

import java.time.Clock;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class RmsPropertiesTest {
    private final ApplicationContextRunner runner = new ApplicationContextRunner()
            .withConfiguration(AutoConfigurations.of(ValidationAutoConfiguration.class))
            .withInitializer(context -> removeAmbientProperties(context))
            .withUserConfiguration(PropertiesConfiguration.class);

    @Test
    void acceptsValidConfigurationAndDefaultsTimezone() {
        runner.withPropertyValues(validProperties()).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(RmsProperties.class).timezone()).isEqualTo("Asia/Kolkata");
            assertThat(context.getBean(RmsProperties.class).trustProxy()).isFalse();
            assertThat(context.getBean(RmsProperties.class).rateLimitLoginMax()).isEqualTo(5);
            assertThat(context.getBean(RmsProperties.class).rateLimitRegisterMax()).isEqualTo(10);
            assertThat(context.getBean(RmsProperties.class).rateLimitContactMax()).isEqualTo(5);
            assertThat(context.getBean(RmsProperties.class).dbPoolMax()).isEqualTo(5);
            assertThat(context.getBean(RmsProperties.class).trustedProxyHops()).isEqualTo(1);
        });
    }

    @Test
    void acceptsConfiguredRateLimitOverrides() {
        runner.withPropertyValues(validProperties())
                .withPropertyValues("rms.rate-limit-login-max=12", "rms.rate-limit-register-max=42", "rms.rate-limit-contact-max=99")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    RmsProperties properties = context.getBean(RmsProperties.class);
                    assertThat(properties.rateLimitLoginMax()).isEqualTo(12);
                    assertThat(properties.rateLimitRegisterMax()).isEqualTo(42);
                    assertThat(properties.rateLimitContactMax()).isEqualTo(99);
                });
    }

    @Test
    void acceptsDatabasePoolAndTrustedProxyHopOverrides() {
        runner.withPropertyValues(validProperties())
                .withPropertyValues("rms.db-pool-max=14", "rms.trusted-proxy-hops=3")
                .run(context -> {
                    assertThat(context).hasNotFailed();
                    RmsProperties properties = context.getBean(RmsProperties.class);
                    assertThat(properties.dbPoolMax()).isEqualTo(14);
                    assertThat(properties.trustedProxyHops()).isEqualTo(3);
                });
    }

    @Test
    void rejectsDatabasePoolOutsideOneToTwenty() {
        runner.withPropertyValues(validProperties()).withPropertyValues("rms.db-pool-max=21")
                .run(context -> assertFailureMentions(context, "RMS_DB_POOL_MAX"));
        runner.withPropertyValues(validProperties()).withPropertyValues("rms.db-pool-max=0")
                .run(context -> assertFailureMentions(context, "RMS_DB_POOL_MAX"));
    }

    @Test
    void rejectsTrustedProxyHopsOutsideOneToFive() {
        runner.withPropertyValues(validProperties()).withPropertyValues("rms.trusted-proxy-hops=6")
                .run(context -> assertFailureMentions(context, "RMS_TRUSTED_PROXY_HOPS"));
        runner.withPropertyValues(validProperties()).withPropertyValues("rms.trusted-proxy-hops=0")
                .run(context -> assertFailureMentions(context, "RMS_TRUSTED_PROXY_HOPS"));
    }

    @Test
    void rejectsRateLimitOverridesOutsideOneToTenThousand() {
        runner.withPropertyValues(validProperties()).withPropertyValues("rms.rate-limit-register-max=10001")
                .run(context -> assertFailureMentions(context, "RMS_RATE_LIMIT_REGISTER_MAX"));
    }

    @Test
    void rejectsZeroRateLimitOverride() {
        runner.withPropertyValues(validProperties()).withPropertyValues("rms.rate-limit-login-max=0")
                .run(context -> assertFailureMentions(context, "RMS_RATE_LIMIT_LOGIN_MAX"));
    }

    @Test
    void validConfigurationStartsAndClockUsesConfiguredTimezone() {
        runner.withPropertyValues(withTimezone(validProperties(), "Pacific/Auckland")).run(context -> {
            assertThat(context).hasNotFailed();
            assertThat(context.getBean(Clock.class).getZone()).isEqualTo(ZoneId.of("Pacific/Auckland"));
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
        runner.withPropertyValues(withTimezone(validProperties(), "Not/A_Real_Zone"))
                .run(context -> assertFailureMentions(context, "RMS_TIMEZONE"));
    }

    @Test
    void failsForEmptyTimezone() {
        runner.withPropertyValues(withTimezone(validProperties(), " "))
                .run(context -> assertFailureMentions(context, "RMS_TIMEZONE"));
    }

    @Test
    void failsWhenSuperadminEmailIsMissing() {
        runner.withPropertyValues(without(validProperties(), "rms.superadmin-email=superadmin@example.test"))
                .run(context -> assertFailureMentions(context, "RMS_SUPERADMIN_EMAIL"));
    }

    @Test
    void failsWhenBootstrapPasswordViolatesPolicy() {
        runner.withPropertyValues(replace(validProperties(), "rms.superadmin-password=Replace123", "rms.superadmin-password=weak"))
                .run(context -> assertFailureMentions(context, "RMS_SUPERADMIN_PASSWORD"));
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

    private static String[] withTimezone(String[] source, String timezone) {
        String[] withoutDefault = without(source, "rms.timezone=Asia/Kolkata");
        String[] result = java.util.Arrays.copyOf(withoutDefault, withoutDefault.length + 1);
        result[result.length - 1] = "rms.timezone=" + timezone;
        return result;
    }

    private static void removeAmbientProperties(ConfigurableApplicationContext context) {
        context.getEnvironment().getPropertySources().remove("systemEnvironment");
        context.getEnvironment().getPropertySources().remove("systemProperties");
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
    @Import(ClockConfiguration.class)
    static class PropertiesConfiguration {}
}

