package com.rms.resident.integration;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.rms.resident.auth.JwtService;
import com.rms.resident.catalog.ServiceItemRepository;
import com.rms.resident.common.enums.Role;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import java.time.Clock;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.*;
import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = {
        "logging.level.org.hibernate.SQL=DEBUG",
        "logging.level.org.hibernate.orm.jdbc.bind=TRACE"
})
class UserCatalogIT {
    private static final String PASSWORD = "Resident123";
    private static final java.util.concurrent.atomic.AtomicInteger IP = new java.util.concurrent.atomic.AtomicInteger(20);
    @DynamicPropertySource static void properties(DynamicPropertyRegistry registry) { SharedMySqlContainer.registerProperties(registry); }
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired UserAccountRepository users;
    @Autowired ServiceItemRepository services;
    @Autowired PasswordEncoder encoder;
    @Autowired JwtService jwt;
    @Autowired Clock clock;
    @Autowired JdbcTemplate jdbc;

    @Test void userEndpointsEnforceRoleMatrixAndAccountScope() throws Exception {
        UserAccount resident = user(Role.USER, true);
        UserAccount otherResident = user(Role.USER, true);
        UserAccount admin = user(Role.ADMIN, true);
        UserAccount otherAdmin = user(Role.ADMIN, true);
        UserAccount superAdmin = users.findByRole(Role.SUPER_ADMIN).get(0);
        String residentToken = token(resident), adminToken = token(admin), superToken = token(superAdmin);
        mvc.perform(get("/api/v1/users")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/users").contentType(MediaType.APPLICATION_JSON)
                .content(createBody("Anon Resident", "anon-" + UUID.randomUUID() + "@example.test", "A-1", "USER")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users/{id}", resident.getId())).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/users/{id}", resident.getId()).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/v1/users/{id}/activation", resident.getId()).contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/users").header("Authorization", bearer(residentToken))).andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/users").header("Authorization", bearer(adminToken))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users").param("role", "ADMIN").header("Authorization", bearer(adminToken)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/users").param("role", "SUPER_ADMIN").header("Authorization", bearer(adminToken)))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/users").header("Authorization", bearer(superToken))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users/{id}", otherAdmin.getId()).header("Authorization", bearer(adminToken))).andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/users/{id}", otherAdmin.getId()).header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Valid Admin\",\"email\":\"" + otherAdmin.getEmail() + "\",\"flatNumber\":null}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/users/{id}/activation", otherAdmin.getId()).header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/users/{id}/activation", superAdmin.getId()).header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isForbidden());
        mvc.perform(get("/api/v1/users/{id}", 99999999).header("Authorization", bearer(superToken))).andExpect(status().isNotFound());

        String createUser = createBody("Created Resident", "new-" + UUID.randomUUID() + "@example.test", "C-9", "USER");
        mvc.perform(post("/api/v1/users").header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON).content(createUser))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("USER"));
        mvc.perform(post("/api/v1/users").header("Authorization", bearer(adminToken)).contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("Created Admin", "a-" + UUID.randomUUID() + "@example.test", null, "ADMIN")))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/users").header("Authorization", bearer(superToken)).contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("Created Admin", "a-" + UUID.randomUUID() + "@example.test", null, "ADMIN")))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.role").value("ADMIN"));
        for (String actorToken : new String[]{residentToken, adminToken, superToken})
            mvc.perform(post("/api/v1/users").header("Authorization", bearer(actorToken)).contentType(MediaType.APPLICATION_JSON)
                            .content(createBody("Forbidden", "f-" + UUID.randomUUID() + "@example.test", null, "SUPER_ADMIN")))
                    .andExpect(status().isForbidden());

        mvc.perform(get("/api/v1/users/{id}", resident.getId()).header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.password").doesNotExist()).andExpect(jsonPath("$.passwordHash").doesNotExist());
        mvc.perform(get("/api/v1/users/{id}", otherResident.getId()).header("Authorization", bearer(superToken))).andExpect(status().isOk());
        mvc.perform(put("/api/v1/users/{id}", otherResident.getId()).header("Authorization", bearer(superToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"fullName\":\"Renamed Resident\",\"email\":\"" + otherResident.getEmail() + "\",\"flatNumber\":\"NEW-1\"}"))
                .andExpect(status().isOk());
        mvc.perform(patch("/api/v1/users/{id}/activation", otherResident.getId()).header("Authorization", bearer(superToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
    }

    @Test void userCreateUpdateDuplicateValidationSearchSortAndPagination() throws Exception {
        UserAccount admin = user(Role.ADMIN, true); String auth = bearer(token(admin));
        String email = "dupe-" + UUID.randomUUID() + "@example.test";
        String body = createBody("Query 100% literal", email, "Q_1", "USER");
        String created = mvc.perform(post("/api/v1/users").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        assertThat(created).doesNotContain(PASSWORD, "passwordHash", "password_hash");
        assertUserSearch(auth, Role.ADMIN, "%", 1);
        assertUserSearch(auth, Role.ADMIN, "_", 0);
        mvc.perform(post("/api/v1/users").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content(createBody("Duplicate", email.toUpperCase(Locale.ROOT), "Q_2", "USER")))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE"));
        JsonNode node = mapper.readTree(created);
        long id = node.get("id").asLong();
        mvc.perform(put("/api/v1/users/{id}", id).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Updated Resident\",\"email\":\"" + email + "\",\"flatNumber\":\"Q-2\",\"role\":\"ADMIN\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(put("/api/v1/users/{id}", id).header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Updated Resident\",\"email\":\"" + email + "\",\"flatNumber\":\"Q-2\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.flatNumber").value("Q-2"));
        for (String sort : new String[]{"createdAt,desc", "fullName,asc", "email,desc", "role,asc"})
            mvc.perform(get("/api/v1/users").param("sort", sort).header("Authorization", auth)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/users").param("sort", "passwordHash,asc").header("Authorization", auth))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"));
        mvc.perform(get("/api/v1/users").param("size", "101").header("Authorization", auth))
                .andExpect(status().isOk()).andExpect(jsonPath("$.size").value(100));
        mvc.perform(post("/api/v1/users").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Invalid\",\"email\":\"invalid-" + UUID.randomUUID() + "@example.test\",\"password\":\"Resident123\",\"role\":\"USER\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(post("/api/v1/users").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"fullName\":\"Invalid\",\"email\":\"invalid-" + UUID.randomUUID() + "@example.test\",\"password\":\"Resident123\",\"role\":\"ADMIN\",\"flatNumber\":\"A-1\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test void concurrentDuplicateUserCreatesProduceOneCreatedAndOneConflict() throws Exception {
        UserAccount admin = user(Role.ADMIN, true); String auth = bearer(token(admin));
        String email = "race-" + UUID.randomUUID() + "@example.test";
        String body = createBody("Race Resident", email, "R-1", "USER");
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> call = () -> mvc.perform(post("/api/v1/users").header("Authorization", auth)
                    .with(remoteIp()).contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus();
            Future<Integer> a = executor.submit(call), b = executor.submit(call);
            int x = a.get(30, TimeUnit.SECONDS), y = b.get(30, TimeUnit.SECONDS);
            assertThat(java.util.List.of(x, y)).containsExactlyInAnyOrder(201, 409);
        } finally { executor.shutdownNow(); }
    }

    @Test void deactivationBlocksLoginAndExistingTokenAndSupportsReactivation() throws Exception {
        UserAccount admin = user(Role.ADMIN, true), resident = user(Role.USER, true);
        String adminAuth = bearer(token(admin)), userToken = token(resident);
        mvc.perform(patch("/api/v1/users/{id}/activation", resident.getId()).header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mvc.perform(post("/api/v1/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"" + resident.getEmail() + "\",\"password\":\"" + PASSWORD + "\"}"))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"));
        mvc.perform(get("/api/v1/auth/me").header("Authorization", bearer(userToken)))
                .andExpect(status().isUnauthorized()).andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
        mvc.perform(patch("/api/v1/users/{id}/activation", resident.getId()).header("Authorization", bearer(userToken))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isUnauthorized());
        UserAccount superAdmin = users.findByRole(Role.SUPER_ADMIN).get(0);
        mvc.perform(patch("/api/v1/users/{id}/activation", superAdmin.getId()).header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/users/{id}/activation", admin.getId()).header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("You cannot deactivate your own account"));
        mvc.perform(patch("/api/v1/users/{id}/activation", superAdmin.getId()).header("Authorization", bearer(token(superAdmin)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.message").value("You cannot deactivate your own account"));
        mvc.perform(patch("/api/v1/users/{id}/activation", resident.getId()).header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":true}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(true));
    }

    @Test void serviceCatalogVisibilityUniquenessAndSoftDeactivation() throws Exception {
        UserAccount resident = user(Role.USER, true), admin = user(Role.ADMIN, true);
        String userAuth = bearer(token(resident)), adminAuth = bearer(token(admin));
        UserAccount superAdmin = users.findByRole(Role.SUPER_ADMIN).get(0);
        String superAuth = bearer(token(superAdmin));
        mvc.perform(get("/api/v1/services")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/services").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Anonymous Service\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/services/1")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/services/1").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Anonymous Service\"}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(patch("/api/v1/services/1/activation").contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isUnauthorized());
        String suffix = UUID.randomUUID().toString();
        String name = "WiFi " + suffix;
        String create = "{\"name\":\"" + name + "\",\"description\":\"Repair\"}";
        mvc.perform(post("/api/v1/services").header("Authorization", userAuth).contentType(MediaType.APPLICATION_JSON).content(create))
                .andExpect(status().isForbidden());
        String response = mvc.perform(post("/api/v1/services").header("Authorization", adminAuth).contentType(MediaType.APPLICATION_JSON).content(create))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        long id = mapper.readTree(response).get("id").asLong();
        assertThat(jdbc.queryForObject("SELECT created_by FROM services WHERE id = ?", Long.class, id)).isEqualTo(admin.getId());
        assertServiceListed(userAuth, Role.USER, "false", id, true);
        assertServiceListed(adminAuth, Role.ADMIN, "false", id, false);
        MvcResult userActiveOnly = mvc.perform(get("/api/v1/services").param("active", "false").header("Authorization", userAuth))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode item : mapper.readTree(userActiveOnly.getResponse().getContentAsString()).get("content"))
            assertThat(item.get("active").asBoolean()).isTrue();
        mvc.perform(patch("/api/v1/services/{id}/activation", id).header("Authorization", adminAuth)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.active").value(false));
        mvc.perform(get("/api/v1/services/{id}", id).header("Authorization", userAuth)).andExpect(status().isNotFound());
        mvc.perform(get("/api/v1/services/{id}", id).header("Authorization", adminAuth)).andExpect(status().isOk());
        assertServiceListed(userAuth, Role.USER, null, id, false);
        assertServiceListed(adminAuth, Role.ADMIN, "true", id, false);
        assertServiceListed(adminAuth, Role.ADMIN, "false", id, true);
        assertServiceListed(adminAuth, Role.ADMIN, "true", name, id, false);
        assertServiceListed(adminAuth, Role.ADMIN, "false", name, id, true);
        MvcResult inactiveOnly = mvc.perform(get("/api/v1/services").param("active", "false").header("Authorization", adminAuth))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode item : mapper.readTree(inactiveOnly.getResponse().getContentAsString()).get("content"))
            assertThat(item.get("active").asBoolean()).isFalse();
        MvcResult activeOnly = mvc.perform(get("/api/v1/services").param("active", "true").header("Authorization", adminAuth))
                .andExpect(status().isOk()).andReturn();
        for (JsonNode item : mapper.readTree(activeOnly.getResponse().getContentAsString()).get("content"))
            assertThat(item.get("active").asBoolean()).isTrue();
        assertServiceListed(userAuth, Role.USER, "false", name, id, false);
        mvc.perform(put("/api/v1/services/{id}", id).header("Authorization", adminAuth).contentType(MediaType.APPLICATION_JSON).content(create))
                .andExpect(status().isOk());
        String accentName = "Café " + suffix;
        String accent = mvc.perform(post("/api/v1/services").header("Authorization", adminAuth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\":\"" + accentName + "\"}")).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        mvc.perform(post("/api/v1/services").header("Authorization", adminAuth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"CAFE " + suffix + "\"}"))
                .andExpect(status().isConflict()).andExpect(jsonPath("$.code").value("DUPLICATE_RESOURCE"));
        long accentId = mapper.readTree(accent).get("id").asLong();
        mvc.perform(get("/api/v1/services").param("active", "false").header("Authorization", adminAuth))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM services WHERE id = ?", Integer.class, id)).isEqualTo(1);
        assertThat(services.findById(accentId)).isPresent();
        mvc.perform(post("/api/v1/services").header("Authorization", superAuth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\":\"Super Service " + suffix + "\"}"))
                .andExpect(status().isCreated());
        mvc.perform(get("/api/v1/services").param("q", "%").header("Authorization", adminAuth))
                .andExpect(status().isOk()).andExpect(jsonPath("$.totalElements").value(0));
    }

    @Test void concurrentDuplicateServiceCreatesProduceOneCreatedAndOneConflict() throws Exception {
        UserAccount admin = user(Role.ADMIN, true); String auth = bearer(token(admin));
        String body = "{\"name\":\"Concurrent " + UUID.randomUUID() + "\",\"description\":\"race\"}";
        ExecutorService executor = Executors.newFixedThreadPool(2);
        try {
            Callable<Integer> call = () -> mvc.perform(post("/api/v1/services").header("Authorization", auth)
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andReturn().getResponse().getStatus();
            Future<Integer> a = executor.submit(call), b = executor.submit(call);
            assertThat(java.util.List.of(a.get(30, TimeUnit.SECONDS), b.get(30, TimeUnit.SECONDS)))
                    .containsExactlyInAnyOrder(201, 409);
        } finally { executor.shutdownNow(); }
    }

    @Test void anonymousAndWrongRoleServiceMatrix() throws Exception {
        UserAccount user = user(Role.USER, true);
        String userAuth = bearer(token(user));
        mvc.perform(get("/api/v1/services")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/services").header("Authorization", userAuth)).andExpect(status().isOk());
        mvc.perform(get("/api/v1/services/1")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/services/1").header("Authorization", userAuth)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/services").header("Authorization", userAuth).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Nope\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(put("/api/v1/services/1").header("Authorization", userAuth).contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"Nope\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(patch("/api/v1/services/1/activation").header("Authorization", userAuth).contentType(MediaType.APPLICATION_JSON).content("{\"active\":false}"))
                .andExpect(status().isForbidden());
    }

    private UserAccount user(Role role, boolean active) {
        UserAccount u = users.saveAndFlush(UserAccount.create("Catalog " + role, "catalog-" + UUID.randomUUID() + "@example.test",
                encoder.encode(PASSWORD), role, role == Role.USER ? "CAT-1" : null, clock.instant()));
        if (!active) jdbc.update("UPDATE users SET active=FALSE WHERE id=?", u.getId());
        return users.findById(u.getId()).orElseThrow();
    }
    private String token(UserAccount user) { return jwt.issue(user).value(); }
    private static String bearer(String value) { return "Bearer " + value; }
    private static String createBody(String name, String email, String flat, String role) {
        return "{\"fullName\":\"" + name + "\",\"email\":\"" + email + "\",\"password\":\"" + PASSWORD + "\",\"role\":\"" + role + "\"" + (flat == null ? "" : ",\"flatNumber\":\"" + flat + "\"") + "}";
    }
    private void assertServiceListed(String authorization, Role actorRole, String active, long id, boolean expected) throws Exception {
        assertServiceListed(authorization, actorRole, active, null, id, expected);
    }
    private void assertServiceListed(String authorization, Role actorRole, String active, String q, long id, boolean expected) throws Exception {
        var builder = get("/api/v1/services").header("Authorization", authorization);
        if (active != null) builder.param("active", active);
        if (q != null) builder.param("q", q);
        MvcResult result = mvc.perform(builder).andExpect(status().isOk()).andReturn();
        String responseBody = result.getResponse().getContentAsString();
        JsonNode items = mapper.readTree(responseBody).get("content");
        boolean found = false;
        for (JsonNode item : items) found |= item.get("id").asLong() == id;
        assertThat(found).as("GET /api/v1/services?active=%s&q=%s actorRole=%s response=%s",
                active, q, actorRole, responseBody).isEqualTo(expected);
    }
    private void assertUserSearch(String authorization, Role actorRole, String q, long expectedTotal) throws Exception {
        MvcResult result = mvc.perform(get("/api/v1/users").param("q", q).header("Authorization", authorization))
                .andExpect(status().isOk()).andReturn();
        String responseBody = result.getResponse().getContentAsString();
        long total = mapper.readTree(responseBody).path("totalElements").asLong();
        assertThat(total).as("GET /api/v1/users?q=%s actorRole=%s response=%s", q, actorRole, responseBody)
                .isEqualTo(expectedTotal);
    }
    private static RequestPostProcessor remoteIp() { return request -> { request.setRemoteAddr("198.51.100." + (IP.incrementAndGet() % 250)); return request; }; }
}
