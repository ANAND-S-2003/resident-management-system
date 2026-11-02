package com.rms.resident.security;

import com.rms.resident.auth.JwtService;
import com.rms.resident.catalog.ServiceCatalogService;
import com.rms.resident.common.config.RmsProperties;
import com.rms.resident.common.ratelimit.ClientIpResolver;
import com.rms.resident.common.ratelimit.RateLimiter;
import com.rms.resident.user.UserAccountRepository;
import com.rms.resident.user.UserAdministrationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.web.servlet.MockMvc;
import java.time.Clock;
import java.util.List;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = {
        com.rms.resident.user.UserAdministrationController.class,
        com.rms.resident.catalog.ServiceCatalogController.class,
        com.rms.resident.request.RequestController.class,
        com.rms.resident.notification.NotificationController.class
})
@Import({SecurityConfiguration.class, SecurityErrorWriter.class, ApiAuthenticationEntryPoint.class,
        ApiAccessDeniedHandler.class, UserCatalogAuthorizationTest.TestBeans.class})
class UserCatalogAuthorizationTest {
    @Autowired MockMvc mvc;
    @MockBean JwtService jwtService;
    @MockBean UserAccountRepository users;
    @MockBean UserAdministrationService userService;
    @MockBean ServiceCatalogService serviceCatalog;
    @MockBean com.rms.resident.request.RequestService requestService;
    @MockBean com.rms.resident.notification.NotificationService notificationService;

    @Test void authorizationPrecedesRequiredBodyValidationOnAllAdminRoutes() throws Exception {
        assertDeniedBeforeValidation(null, 401);
        assertDeniedBeforeValidation("ROLE_USER", 403);
    }

    @Test void requestAndNotificationAuthorizationPrecedesBodyValidation() throws Exception {
        mvc.perform(patch("/api/v1/requests/1").contentType("application/json").content("")
                .with(user("user").authorities(new SimpleGrantedAuthority("ROLE_USER"))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        mvc.perform(patch("/api/v1/requests/1").contentType("application/json").content(""))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(post("/api/v1/requests").contentType("application/json").content("")
                .with(user("admin").authorities(new SimpleGrantedAuthority("ROLE_ADMIN"))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        for (String role : List.of("ROLE_ADMIN", "ROLE_SUPER_ADMIN")) {
            mvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get("/api/v1/notifications")
                    .with(user("admin").authorities(new SimpleGrantedAuthority(role))))
                    .andExpect(status().isForbidden()).andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
    }

    private void assertDeniedBeforeValidation(String authority, int expectedStatus) throws Exception {
        var postUsers = post("/api/v1/users");
        var putUsers = put("/api/v1/users/1");
        var postServices = post("/api/v1/services");
        var putServices = put("/api/v1/services/1");
        for (var request : List.of(postUsers, putUsers, postServices, putServices)) {
            var builder = request.contentType("application/json");
            if (authority != null) builder.with(user("test").authorities(new SimpleGrantedAuthority(authority)));
            var result = mvc.perform(builder).andExpect(status().is(expectedStatus));
            if (expectedStatus == 401) result.andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
            else result.andExpect(jsonPath("$.code").value("FORBIDDEN"));
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestBeans {
        @Bean Clock clock() { return Clock.systemUTC(); }
        @Bean RmsProperties rmsProperties() {
            return new RmsProperties("mvc-test-jwt-secret-with-at-least-32-bytes", "bootstrap@example.test",
                    "Bootstrap Admin", "Bootstrap123", "UTC", List.of(), false);
        }
        @Bean ClientIpResolver clientIpResolver(RmsProperties properties) { return new ClientIpResolver(properties); }
        @Bean("registerRateLimiter") RateLimiter registerRateLimiter(Clock clock) { return new RateLimiter(clock); }
    }
}
