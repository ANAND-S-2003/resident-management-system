package com.rms.resident.common.ratelimit;

import com.rms.resident.common.config.RmsProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.Duration;

@Configuration(proxyBeanMethods = false)
public class RateLimiterConfiguration {
    private static final int MAX_TRACKED_KEYS = 10_000;

    @Bean("loginRateLimiter")
    RateLimiter loginRateLimiter(Clock clock, RmsProperties properties) {
        return new RateLimiter(clock, MAX_TRACKED_KEYS, properties.rateLimitLoginMax(), Duration.ofMinutes(15));
    }

    @Bean("registerRateLimiter")
    RateLimiter registerRateLimiter(Clock clock, RmsProperties properties) {
        return new RateLimiter(clock, MAX_TRACKED_KEYS, properties.rateLimitRegisterMax(), Duration.ofHours(1));
    }

    @Bean("contactRateLimiter")
    RateLimiter contactRateLimiter(Clock clock, RmsProperties properties) {
        return new RateLimiter(clock, MAX_TRACKED_KEYS, properties.rateLimitContactMax(), Duration.ofHours(1));
    }
}
