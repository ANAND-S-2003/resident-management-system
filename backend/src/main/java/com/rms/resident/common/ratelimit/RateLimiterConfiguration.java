package com.rms.resident.common.ratelimit;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.Duration;

@Configuration(proxyBeanMethods = false)
public class RateLimiterConfiguration {
    private static final int MAX_TRACKED_KEYS = 10_000;

    @Bean("loginRateLimiter")
    RateLimiter loginRateLimiter(Clock clock) {
        return new RateLimiter(clock, MAX_TRACKED_KEYS, 5, Duration.ofMinutes(15));
    }

    @Bean("registerRateLimiter")
    RateLimiter registerRateLimiter(Clock clock) {
        return new RateLimiter(clock, MAX_TRACKED_KEYS, 10, Duration.ofHours(1));
    }
}
