package com.rms.resident.common.error;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(value = ErrorProbeController.class, properties = {
        "RMS_DB_URL=jdbc:mysql://localhost:3307/rms",
        "RMS_DB_USER=test",
        "RMS_DB_PASSWORD=test",
        "RMS_JWT_SECRET=test-secret-that-is-longer-than-32-bytes",
        "RMS_SUPERADMIN_EMAIL=root@example.test",
        "RMS_SUPERADMIN_NAME=Test Super Admin",
        "RMS_SUPERADMIN_PASSWORD=TestPassword123",
        "RMS_TIMEZONE=Asia/Kolkata",
        "RMS_CORS_ALLOWED_ORIGINS=",
        "RMS_TRUST_PROXY=false",
        "logging.level.com.rms.resident.common.error.GlobalExceptionHandler=OFF"
})
@AutoConfigureMockMvc(addFilters = false)
@Import(GlobalExceptionHandlerTest.ClockConfiguration.class)
class GlobalExceptionHandlerTest {
    @Autowired MockMvc mockMvc;

    @Test
    void mapsEveryDocumentedErrorCodeToItsHttpStatusAndSafeEnvelope() throws Exception {
        for (ErrorCode code : ErrorCode.values()) {
            mockMvc.perform(get("/__test/error/{code}", code.name()))
                    .andExpect(status().is(code.httpStatus().value()))
                    .andExpect(jsonPath("$.timestamp").value("2026-01-02T03:04:05Z"))
                    .andExpect(jsonPath("$.status").value(code.httpStatus().value()))
                    .andExpect(jsonPath("$.code").value(code.name()))
                    .andExpect(jsonPath("$.message").value("controlled error"))
                    .andExpect(jsonPath("$.path").value("/__test/error/" + code.name()))
                    .andExpect(jsonPath("$.details").isArray());
        }
    }

    @Test
    void mapsBodyValidationAndMalformedOrUnknownJsonToValidationError() throws Exception {
        mockMvc.perform(post("/__test/body").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details[0].field").value("name"));

        mockMvc.perform(post("/__test/body").contentType(MediaType.APPLICATION_JSON).content("{"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));

        mockMvc.perform(post("/__test/body").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"valid\",\"unknown\":true}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void mapsWrongParameterTypesMissingRoutesAndMethods() throws Exception {
        mockMvc.perform(get("/__test/typed").param("count", "not-a-number"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details[0].field").value("count"));

        mockMvc.perform(get("/__test/minimum").param("value", "0"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details[0].field").value("value"));

        mockMvc.perform(get("/__test/does-not-exist"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));

        mockMvc.perform(get("/__test/post-only"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void mapsOptimisticLockAndUnexpectedFailuresWithoutLeakingDetails() throws Exception {
        String optimistic = mockMvc.perform(get("/__test/optimistic"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONCURRENT_MODIFICATION"))
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(optimistic).doesNotContain("stackTrace", "OptimisticLockingFailureException");

        String unexpected = mockMvc.perform(get("/__test/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(unexpected)
                .doesNotContain("stackTrace", "IllegalStateException", "SELECT", "secret detail");
    }

    @Test
    void mapsSecurityExceptionsToStandardForbiddenAndUnauthenticatedErrors() throws Exception {
        String denied = mockMvc.perform(get("/__test/access-denied"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.timestamp").value("2026-01-02T03:04:05Z"))
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("You do not have permission to access this resource"))
                .andExpect(jsonPath("$.path").value("/__test/access-denied"))
                .andExpect(jsonPath("$.details").isArray())
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(denied)
                .doesNotContain("stackTrace", "AccessDeniedException", "AuthorizationDeniedException", "secret authorization rule detail");

        String unauthenticated = mockMvc.perform(get("/__test/authentication-failure"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.timestamp").value("2026-01-02T03:04:05Z"))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.message").value("Authentication is required or the token is invalid"))
                .andExpect(jsonPath("$.path").value("/__test/authentication-failure"))
                .andExpect(jsonPath("$.details").isArray())
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(unauthenticated)
                .doesNotContain("stackTrace", "BadCredentialsException", "secret authentication detail");

        String unexpected = mockMvc.perform(get("/__test/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.status").value(500))
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andReturn().getResponse().getContentAsString();
        org.assertj.core.api.Assertions.assertThat(unexpected)
                .doesNotContain("stackTrace", "IllegalStateException", "secret detail");
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class ClockConfiguration {
        @Bean Clock testClock() {
            return Clock.fixed(Instant.parse("2026-01-02T03:04:05Z"), ZoneOffset.UTC);
        }

        @Bean UserDetailsService suppressGeneratedTestPassword() {
            return username -> { throw new UsernameNotFoundException("No test password authentication is configured"); };
        }
    }

}

