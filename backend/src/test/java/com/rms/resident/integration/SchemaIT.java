package com.rms.resident.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@Testcontainers
@SpringBootTest
@AutoConfigureMockMvc
class SchemaIT {
    @Container
    static final MySQLContainer MYSQL = new MySQLContainer(DockerImageName.parse("mysql:8.4"))
            .withDatabaseName("rms")
            .withUsername("rms_test")
            .withPassword("rms_test_password");

    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", () -> {
            String url = MYSQL.getJdbcUrl();
            return url + (url.contains("?") ? "&" : "?")
                    + "connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true";
        });
        registry.add("spring.datasource.username", MYSQL::getUsername);
        registry.add("spring.datasource.password", MYSQL::getPassword);
        registry.add("rms.jwt-secret", () -> "test-secret-that-is-longer-than-32-bytes");
        registry.add("rms.superadmin-email", () -> "root@example.test");
        registry.add("rms.superadmin-name", () -> "Test Super Admin");
        registry.add("rms.superadmin-password", () -> "TestPassword123");
        registry.add("rms.timezone", () -> "Asia/Kolkata");
        registry.add("rms.cors-allowed-origins", () -> "");
        registry.add("rms.trust-proxy", () -> "false");
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mockMvc;

    @Test
    void migrationsCreateSchemaAndSeedFiveServices() {
        assertThat(jdbc.queryForList("SELECT name FROM services ORDER BY name", String.class))
                .containsExactly("Cleaning", "Electrical", "Internet Repair", "Painting", "Plumbing");
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM flyway_schema_history WHERE success = TRUE", Integer.class))
                .isGreaterThanOrEqualTo(2);
    }

    @Test
    void schemaEnforcesCaseInsensitiveEmailUniqueness() {
        String email = uniqueEmail("CaseSensitive");
        insertUser("USER", "A-101", email);
        assertThatThrownBy(() -> insertUser("USER", "A-102", email.toUpperCase(java.util.Locale.ROOT)))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void schemaEnforcesRoleAndFlatNumberConstraints() {
        assertThatThrownBy(() -> insertUser("USER", null, uniqueEmail("user-no-flat"))).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> insertUser("ADMIN", "A-101", uniqueEmail("admin-flat"))).isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> insertUser("INVALID_ROLE", null, uniqueEmail("invalid-role"))).isInstanceOf(RuntimeException.class);
    }

    @Test
    void schemaEnforcesRequestDatesAndStatuses() {
        long residentId = insertUser("USER", "A-103", uniqueEmail("request-date"));
        long serviceId = jdbc.queryForObject("SELECT id FROM services WHERE name = 'Plumbing'", Long.class);
        assertThatThrownBy(() -> insertRequest(residentId, serviceId, "2026-01-02", "2026-01-01", "PENDING"))
                .isInstanceOf(RuntimeException.class);
        assertThatThrownBy(() -> insertRequest(residentId, serviceId, "2026-01-01", "2026-01-02", "NOT_A_STATUS"))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void deletingResidentWithRequestIsRestricted() {
        long residentId = insertUser("USER", "A-104", uniqueEmail("request-restrict"));
        long serviceId = jdbc.queryForObject("SELECT id FROM services WHERE name = 'Electrical'", Long.class);
        insertRequest(residentId, serviceId, "2026-01-01", "2026-01-02", "PENDING");
        assertThatThrownBy(() -> jdbc.update("DELETE FROM users WHERE id = ?", residentId))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void healthIsOnlyUpStatusAndOtherActuatorEndpointsAreNotExposed() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk())
                .andExpect(content().string("{\"status\":\"UP\"}"));
        mockMvc.perform(get("/actuator/info")).andExpect(status().isNotFound());
        mockMvc.perform(get("/actuator/beans")).andExpect(status().isNotFound());
    }

    private long insertUser(String role, String flatNumber, String email) {
        jdbc.update("INSERT INTO users(full_name,email,password_hash,role,flat_number) VALUES (?,?,?,?,?)",
                "Test Resident", email, "not-a-real-hash", role, flatNumber);
        return jdbc.queryForObject("SELECT id FROM users WHERE email = ?", Long.class, email);
    }

    private void insertRequest(long residentId, long serviceId, String requestDate, String expectedDate, String status) {
        jdbc.update("INSERT INTO service_requests(resident_id,flat_number,service_id,description,request_date,expected_completion_date,status) VALUES (?,?,?,?,?,?,?)",
                residentId, "A-101", serviceId, "Schema test request", requestDate, expectedDate, status);
    }

    private String uniqueEmail(String prefix) {
        return prefix + "-" + UUID.randomUUID() + "@example.test";
    }
}
