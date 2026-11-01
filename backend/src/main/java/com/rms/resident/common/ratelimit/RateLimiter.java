package com.rms.resident.common.ratelimit;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Iterator;
import java.util.Map;
import java.util.HashMap;

public class RateLimiter {
    private final Clock clock;
    private final int maxTrackedKeys;
    private final Integer configuredLimit;
    private final Duration configuredWindow;
    private final Map<String, Window> windows = new HashMap<>();

    public RateLimiter(Clock clock) {
        this(clock, 10_000, null, null);
    }

    RateLimiter(Clock clock, int maxTrackedKeys) {
        this(clock, maxTrackedKeys, null, null);
    }

    RateLimiter(Clock clock, int maxTrackedKeys, int limit, Duration duration) {
        this(clock, maxTrackedKeys, Integer.valueOf(limit), duration);
    }

    private RateLimiter(Clock clock, int maxTrackedKeys, Integer configuredLimit, Duration configuredWindow) {
        if (maxTrackedKeys < 1) throw new IllegalArgumentException("maxTrackedKeys must be positive");
        if (configuredLimit != null && (configuredLimit < 1 || configuredWindow == null
                || configuredWindow.isZero() || configuredWindow.isNegative())) {
            throw new IllegalArgumentException("Configured rate limit and duration must be valid");
        }
        this.clock = clock;
        this.maxTrackedKeys = maxTrackedKeys;
        this.configuredLimit = configuredLimit;
        this.configuredWindow = configuredWindow;
    }

    public Decision tryAcquire(String key) {
        if (configuredLimit == null) {
            throw new IllegalStateException("This RateLimiter has no configured limit");
        }
        return tryAcquire(key, configuredLimit, configuredWindow);
    }

    public synchronized Decision tryAcquire(String key, int limit, Duration duration) {
        if (key == null || key.isBlank() || limit < 1 || duration.isZero() || duration.isNegative()) {
            throw new IllegalArgumentException("Rate limit key, limit, and duration must be valid");
        }
        Instant now = clock.instant();
        purgeExpired(now);
        Window window = windows.get(key);
        if (window == null) {
            if (windows.size() >= maxTrackedKeys) {
                return new Decision(false, retryForAnyWindow(now));
            }
            window = new Window(duration);
            windows.put(key, window);
        }
        window.expireBefore(now.minus(duration));
        if (window.timestamps.size() >= limit) {
            return new Decision(false, secondsUntil(window.timestamps.peekFirst().plus(duration), now));
        }
        window.timestamps.addLast(now);
        return new Decision(true, 0);
    }

    public synchronized void reset(String key) {
        windows.remove(key);
    }

    public synchronized int trackedKeyCount() {
        purgeExpired(clock.instant());
        return windows.size();
    }

    private void purgeExpired(Instant now) {
        Iterator<Map.Entry<String, Window>> iterator = windows.entrySet().iterator();
        while (iterator.hasNext()) {
            Map.Entry<String, Window> item = iterator.next();
            item.getValue().expireBefore(now.minus(item.getValue().duration));
            if (item.getValue().timestamps.isEmpty()) iterator.remove();
        }
    }

    private long retryForAnyWindow(Instant now) {
        return windows.values().stream()
                .mapToLong(window -> secondsUntil(window.timestamps.peekFirst().plus(window.duration), now))
                .min().orElse(1);
    }

    private static long secondsUntil(Instant expiry, Instant now) {
        long millis = Math.max(1, Duration.between(now, expiry).toMillis());
        return Math.max(1, (millis + 999) / 1000);
    }

    public record Decision(boolean allowed, long retryAfterSeconds) {}

    private static final class Window {
        private final Duration duration;
        private final ArrayDeque<Instant> timestamps = new ArrayDeque<>();

        private Window(Duration duration) { this.duration = duration; }

        private void expireBefore(Instant cutoff) {
            while (!timestamps.isEmpty() && !timestamps.peekFirst().isAfter(cutoff)) {
                timestamps.removeFirst();
            }
        }
    }
}
