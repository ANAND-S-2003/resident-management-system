package com.rms.resident.common.ratelimit;

import com.rms.resident.common.time.MutableClock;
import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class RateLimiterTest {
    private final MutableClock clock = new MutableClock(Instant.parse("2026-01-01T00:00:00Z"), ZoneOffset.UTC);

    @Test void deniesWhenRollingLimitIsReached() {
        RateLimiter limiter = new RateLimiter(clock);
        assertThat(limiter.tryAcquire("k", 2, Duration.ofMinutes(1)).allowed()).isTrue();
        assertThat(limiter.tryAcquire("k", 2, Duration.ofMinutes(1)).allowed()).isTrue();
        RateLimiter.Decision denied = limiter.tryAcquire("k", 2, Duration.ofMinutes(1));
        assertThat(denied.allowed()).isFalse();
        assertThat(denied.retryAfterSeconds()).isEqualTo(60);
    }

    @Test void allowsAgainAfterTheWindowExpires() {
        RateLimiter limiter = new RateLimiter(clock);
        limiter.tryAcquire("k", 1, Duration.ofMinutes(1));
        clock.advance(Duration.ofMinutes(1));
        assertThat(limiter.tryAcquire("k", 1, Duration.ofMinutes(1)).allowed()).isTrue();
    }

    @Test void resetClearsTheKeyAfterSuccessfulLogin() {
        RateLimiter limiter = new RateLimiter(clock);
        limiter.tryAcquire("k", 1, Duration.ofMinutes(1));
        limiter.reset("k");
        assertThat(limiter.tryAcquire("k", 1, Duration.ofMinutes(1)).allowed()).isTrue();
    }

    @Test void purgesExpiredEntries() {
        RateLimiter limiter = new RateLimiter(clock);
        limiter.tryAcquire("k", 1, Duration.ofMinutes(1));
        clock.advance(Duration.ofMinutes(1));
        assertThat(limiter.trackedKeyCount()).isZero();
    }

    @Test void capsTrackedKeysAndAllowsNewKeysAfterOldEntriesExpire() {
        RateLimiter limiter = new RateLimiter(clock, 1);
        assertThat(limiter.tryAcquire("first", 1, Duration.ofMinutes(1)).allowed()).isTrue();
        assertThat(limiter.tryAcquire("second", 1, Duration.ofMinutes(1)).allowed()).isFalse();
        clock.advance(Duration.ofMinutes(1));
        assertThat(limiter.tryAcquire("second", 1, Duration.ofMinutes(1)).allowed()).isTrue();
        assertThat(limiter.trackedKeyCount()).isEqualTo(1);
    }
}
