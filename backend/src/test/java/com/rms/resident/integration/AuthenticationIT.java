package com.rms.resident.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rms.resident.auth.JwtService;
import com.rms.resident.auth.SuperAdminBootstrap;
import com.rms.resident.common.enums.Role;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.Clock;
import java.util.Date;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@Import(AuthenticationIT.SecurityProbeController.class)
class AuthenticationIT {
    static final String TEST_JWT_SECRET = "integration-test-secret-at-least-32-bytes!!";
    private static final String PASSWORD = "Resident123";
    private static final AtomicInteger IP_SEQUENCE = new AtomicInteger(1);

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        SharedMySqlContainer.registerProperties(registry);
    }

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserAccountRepository users;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired JwtService jwtService;
    @Autowired SuperAdminBootstrap bootstrap;
    @Autowired JdbcTemplate jdbc;
    @Autowired Clock clock;

    @Test
    void registerCreatesOnlyUserAndNeverReturnsPasswordOrHash() throws Exception {
        String password = "Resident123";
        String body = "{\"fullName\":\"  Example Resident  \",\"email\":\"  New-" + UUID.randomUUID()
                + "@Example.Test \",\"password\":\"" + password + "\",\"flatNumber\":\" B-204 \"}";
        String response = mvc.perform(post("/api/v1/auth/register").with(remoteIp())
                        .contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("USER"))
                .andExpect(jsonPath("$.email").value(org.hamcrest.Matchers.endsWith("@example.test")))
                .andExpect(jsonPath("$.fullName").value("Example Resident"))
                .andExpect(jsonPath("$.flatNumber").value("B-204"))
                .andReturn().getResponse().getContentAsString();
        assertThat(response).doesNotContain(password, "password_hash", "passwordHash");
    }

    @Test
    void registerRejectsEachPasswordAndFieldValidationFailureAndUnknownRoleField() throws Exception {
        String email = "invalid-" + UUID.randomUUID() + "@example.test";
        assertRegistrationBad("{\"fullName\":\"A\",\"email\":\"" + email + "\",\"password\":\"Resident123\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"email\":\"" + email + "\",\"password\":\"Resident123\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"password\":\"Resident123\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"" + "N".repeat(121) + "\",\"email\":\"" + email + "\",\"password\":\"Resident123\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"bad\",\"password\":\"Resident123\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + "a".repeat(245) + "@example.test\",\"password\":\"Resident123\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"Short1\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"NoDigitHere\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"12345678\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"" + "é".repeat(36) + "a1\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"A1" + "b".repeat(71) + "\",\"flatNumber\":\"1\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"Resident123\",\"flatNumber\":\"\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"Resident123\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"Resident123\",\"flatNumber\":\"" + "A".repeat(31) + "\"}");
        assertRegistrationBad("{\"fullName\":\"Resident Name\",\"email\":\"" + email + "\",\"password\":\"Resident123\",\"flatNumber\":\"1\",\"role\":\"SUPER_ADMIN\"}");
    }

    @Test
    void duplicateEmailsDifferingOnlyByCaseReturnConflict() throws Exception {
        String email = "case-" + UUID.randomUUID() + "@example.test";
        register(email, PASSWORD, "A-1", remoteIp());
        mvc.perform(post("/api/v1/auth/register").with(remoteIp()).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("Second Resident", email.toUpperCase(java.util.Locale.ROOT), PASSWORD, "A-2")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE"));
    }

    @Test
    void registrationRateLimitReturnsRetryAfter() throws Exception {
        String ip = uniqueIp();
        for (int i = 0; i < 10; i++) {
            mvc.perform(post("/api/v1/auth/register").with(remoteAddr(ip)).contentType(MediaType.APPLICATION_JSON)
                            .content(registerJson("Limit Resident", "limit-" + UUID.randomUUID() + "@example.test", PASSWORD, "L-" + i)))
                    .andExpect(status().isCreated());
        }
        mvc.perform(post("/api/v1/auth/register").with(remoteAddr(ip)).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("Limit Resident", "limit-" + UUID.randomUUID() + "@example.test", PASSWORD, "L-11")))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
    }

    @Test
    void loginSuccessAndCredentialFailuresHaveUniformErrorDetails() throws Exception {
        UserAccount user = createUser(Role.USER, true, PASSWORD);
        mvc.perform(login(user.getEmail(), PASSWORD, remoteIp()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.tokenType").value("Bearer"))
                .andExpect(jsonPath("$.user.role").value("USER"));
        MvcResult wrong = mvc.perform(login(user.getEmail(), "WrongPassword1", remoteIp()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andReturn();
        MvcResult unknown = mvc.perform(login("absent-" + UUID.randomUUID() + "@example.test", "WrongPassword1", remoteIp()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andReturn();
        JsonNode wrongBody = objectMapper.readTree(wrong.getResponse().getContentAsByteArray());
        JsonNode unknownBody = objectMapper.readTree(unknown.getResponse().getContentAsByteArray());
        ((com.fasterxml.jackson.databind.node.ObjectNode) wrongBody).remove("timestamp");
        ((com.fasterxml.jackson.databind.node.ObjectNode) unknownBody).remove("timestamp");
        assertThat(unknownBody).isEqualTo(wrongBody);
    }

    @Test
    void inactiveUserLoginReturnsTheSameCredentialsError() throws Exception {
        UserAccount user = createUser(Role.USER, false, PASSWORD);
        mvc.perform(login(user.getEmail(), PASSWORD, remoteIp()))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("Email or password is incorrect"));
    }

    @Test
    void sixthFailedLoginIsLimitedAndSuccessfulLoginResetsItsCounter() throws Exception {
        UserAccount user = createUser(Role.USER, true, PASSWORD);
        String ip = uniqueIp();
        for (int i = 0; i < 2; i++) mvc.perform(login(user.getEmail(), "WrongPassword1", remoteAddr(ip))).andExpect(status().isUnauthorized());
        mvc.perform(login(user.getEmail(), PASSWORD, remoteAddr(ip))).andExpect(status().isOk());
        for (int i = 0; i < 5; i++) mvc.perform(login(user.getEmail(), "WrongPassword1", remoteAddr(ip))).andExpect(status().isUnauthorized());
        mvc.perform(login(user.getEmail(), "WrongPassword1", remoteAddr(ip)))
                .andExpect(status().isTooManyRequests()).andExpect(header().exists("Retry-After"))
                .andExpect(jsonPath("$.code").value("TOO_MANY_REQUESTS"));
    }

    @Test
    void meRequiresValidCurrentActiveAndRoleMatchingToken() throws Exception {
        UserAccount user = createUser(Role.USER, true, PASSWORD);
        mvc.perform(post("/api/v1/auth/register").with(remoteIp()).header("Authorization", "Bearer invalid-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("Ignored Resident", "ignored-" + UUID.randomUUID() + "@example.test", PASSWORD, "X-1")))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(get("/api/v1/auth/me")).andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", "Bearer garbage-token"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(jwtService.issue(user).value())))
                .andExpect(status().isOk()).andExpect(jsonPath("$.email").value(user.getEmail()));

        String expired = token(user.getId(), Role.USER, TEST_JWT_SECRET, clock.instant().minusSeconds(7200), clock.instant().minusSeconds(3600));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(expired)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        String wrongKey = token(user.getId(), Role.USER, "wrong-key-with-at-least-32-bytes-000000", clock.instant(), clock.instant().plusSeconds(3600));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(wrongKey)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        UserAccount deactivated = createUser(Role.USER, true, PASSWORD);
        String deactivatedToken = jwtService.issue(deactivated).value();
        jdbc.update("UPDATE users SET active = FALSE WHERE id = ?", deactivated.getId());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(deactivatedToken)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));

        UserAccount roleChanged = createUser(Role.USER, true, PASSWORD);
        String oldRoleToken = jwtService.issue(roleChanged).value();
        jdbc.update("UPDATE users SET role = 'ADMIN', flat_number = NULL WHERE id = ?", roleChanged.getId());
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(oldRoleToken)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void changePasswordUpdatesHashAndEnforcesCurrentAndNewPasswordRules() throws Exception {
        UserAccount user = createUser(Role.USER, true, PASSWORD);
        String token = jwtService.issue(user).value();
        mvc.perform(post("/api/v1/auth/change-password").header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"NewResident123\"}"))
                .andExpect(status().isNoContent());
        mvc.perform(login(user.getEmail(), PASSWORD, remoteIp())).andExpect(status().isUnauthorized());
        mvc.perform(login(user.getEmail(), "NewResident123", remoteIp())).andExpect(status().isOk());

        UserAccount another = createUser(Role.USER, true, PASSWORD);
        String anotherToken = jwtService.issue(another).value();
        mvc.perform(post("/api/v1/auth/change-password").header("Authorization", bearer(anotherToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"wrong\",\"newPassword\":\"Another123\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_CURRENT_PASSWORD"));
        mvc.perform(post("/api/v1/auth/change-password").header("Authorization", bearer(anotherToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"short1\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(post("/api/v1/auth/change-password").header("Authorization", bearer(anotherToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"currentPassword\":\"" + PASSWORD + "\",\"newPassword\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    @Test
    void bootstrapIsIdempotentAndDoesNotModifyExistingSuperAdmin() throws Exception {
        UserAccount existing = users.findByRole(Role.SUPER_ADMIN).stream().findFirst().orElseThrow();
        String originalName = existing.getFullName();
        String originalEmail = existing.getEmail();
        var args = new org.springframework.boot.DefaultApplicationArguments(new String[0]);
        bootstrap.run(args);
        bootstrap.run(args);
        bootstrap.run(args);
        UserAccount after = users.findById(existing.getId()).orElseThrow();
        assertThat(after.getFullName()).isEqualTo(originalName);
        assertThat(after.getEmail()).isEqualTo(originalEmail);
    }

    @Test
    void methodSecurityReturns401403And200ForRoleRules() throws Exception {
        UserAccount user = createUser(Role.USER, true, PASSWORD);
        UserAccount admin = createUser(Role.ADMIN, true, PASSWORD);
        UserAccount superAdmin = users.findByRole(Role.SUPER_ADMIN).stream().findFirst().orElseThrow();
        mvc.perform(get("/__test/security/user"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        String denied = mvc.perform(get("/__test/security/user").header("Authorization", bearer(jwtService.issue(admin).value())))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.timestamp").exists())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(jsonPath("$.message").value("You do not have permission to access this resource"))
                .andExpect(jsonPath("$.path").value("/__test/security/user"))
                .andExpect(jsonPath("$.details").isArray())
                .andReturn().getResponse().getContentAsString();
        assertThat(denied).doesNotContain("stackTrace", "AccessDeniedException", "AuthorizationDeniedException");
        mvc.perform(get("/__test/security/user").header("Authorization", bearer(jwtService.issue(user).value())))
                .andExpect(status().isOk()).andExpect(content().string("USER"));
        mvc.perform(get("/__test/security/admin").header("Authorization", bearer(jwtService.issue(user).value())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/__test/security/admin").header("Authorization", bearer(jwtService.issue(admin).value())))
                .andExpect(status().isOk()).andExpect(content().string("ADMIN+"));
        mvc.perform(get("/__test/security/super-admin").header("Authorization", bearer(jwtService.issue(admin).value())))
                .andExpect(status().isForbidden());
        mvc.perform(get("/__test/security/super-admin").header("Authorization", bearer(jwtService.issue(superAdmin).value())))
                .andExpect(status().isOk()).andExpect(content().string("SUPER_ADMIN"));
    }

    @Test
    void corsPreflightAndHealthExposureFollowSecurityConfiguration() throws Exception {
        mvc.perform(options("/api/v1/auth/login").header("Origin", "http://localhost:5173")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "authorization,content-type"))
                .andExpect(status().isOk()).andExpect(header().string("Access-Control-Allow-Origin", "http://localhost:5173"));
        mvc.perform(options("/api/v1/auth/login").header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden()).andExpect(header().doesNotExist("Access-Control-Allow-Origin"));
        mvc.perform(get("/actuator/health")).andExpect(status().isOk()).andExpect(content().string("{\"status\":\"UP\"}"));
        mvc.perform(get("/actuator/info")).andExpect(status().is4xxClientError());
    }

    private void assertRegistrationBad(String json) throws Exception {
        mvc.perform(post("/api/v1/auth/register").with(remoteIp()).contentType(MediaType.APPLICATION_JSON).content(json))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
    }

    private UserAccount register(String email, String password, String flat, RequestPostProcessor ip) throws Exception {
        mvc.perform(post("/api/v1/auth/register").with(ip).contentType(MediaType.APPLICATION_JSON)
                        .content(registerJson("Integration Resident", email, password, flat)))
                .andExpect(status().isCreated());
        return users.findByEmail(email.toLowerCase(java.util.Locale.ROOT)).orElseThrow();
    }

    private UserAccount createUser(Role role, boolean active, String password) {
        UserAccount user = UserAccount.create("Integration " + role, "it-" + UUID.randomUUID() + "@example.test",
                passwordEncoder.encode(password), role, role == Role.USER ? "IT-1" : null, clock.instant());
        UserAccount saved = users.saveAndFlush(user);
        if (!active) jdbc.update("UPDATE users SET active = FALSE WHERE id = ?", saved.getId());
        return users.findById(saved.getId()).orElseThrow();
    }

    private MockHttpServletRequestBuilder login(String email, String password, RequestPostProcessor ip) {
        return post("/api/v1/auth/login").with(ip).contentType(MediaType.APPLICATION_JSON)
                .content("{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}");
    }

    private String registerJson(String name, String email, String password, String flat) {
        return "{\"fullName\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"" + password
                + "\",\"flatNumber\":\"" + flat + "\"}";
    }

    private String token(long userId, Role role, String secret, Instant issuedAt, Instant expiresAt) {
        return Jwts.builder().issuer("rms").subject(Long.toString(userId)).claim("role", role.name())
                .issuedAt(Date.from(issuedAt)).expiration(Date.from(expiresAt))
                .signWith(Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8)), Jwts.SIG.HS256).compact();
    }

    private static String bearer(String token) { return "Bearer " + token; }
    private static RequestPostProcessor remoteIp() { return remoteAddr(uniqueIp()); }
    private static RequestPostProcessor remoteAddr(String ip) { return request -> { request.setRemoteAddr(ip); return request; }; }
    private static String uniqueIp() { return "198.51.100." + (IP_SEQUENCE.getAndIncrement() % 250 + 1); }

    @RestController
    static class SecurityProbeController {
        @GetMapping("/__test/security/user") @PreAuthorize("hasAuthority(T(com.rms.resident.common.enums.Role).USER_AUTHORITY)")
        String user() { return "USER"; }
        @GetMapping("/__test/security/admin") @PreAuthorize("hasAnyAuthority(T(com.rms.resident.common.enums.Role).ADMIN_AUTHORITY,T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
        String admin() { return "ADMIN+"; }
        @GetMapping("/__test/security/super-admin") @PreAuthorize("hasAuthority(T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
        String superAdmin() { return "SUPER_ADMIN"; }
    }
}
