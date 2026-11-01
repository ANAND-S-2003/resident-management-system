package com.rms.resident.integration;

import com.rms.resident.common.ratelimit.RateLimiter;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.context.ApplicationContext;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class ApplicationContextIT {
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        SharedMySqlContainer.registerProperties(registry);
    }

    @Autowired ApplicationContext applicationContext;
    @Autowired @Qualifier("loginRateLimiter") RateLimiter loginRateLimiter;
    @Autowired @Qualifier("registerRateLimiter") RateLimiter registerRateLimiter;

    @Test
    void fullApplicationContextStartsWithDistinctConfiguredRateLimiters() {
        assertThat(applicationContext).isNotNull();
        assertThat(loginRateLimiter).isNotSameAs(registerRateLimiter);
    }
}
