package com.rms.resident.integration;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SchemaIT {
    @DynamicPropertySource
    static void properties(DynamicPropertyRegistry registry) {
        SharedMySqlContainer.registerProperties(registry);
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired MockMvc mockMvc;

    @Test
    void migrationsCreateSchemaAndSeedFiveServices() {
        assertThat(jdbc.queryForList("SELECT name FROM services WHERE active = TRUE AND name IN (?, ?, ?, ?, ?)", String.class,
                "Plumbing", "Electrical", "Cleaning", "Painting", "Internet Repair"))
                .contains("Plumbing", "Electrical", "Cleaning", "Painting", "Internet Repair");
        assertThat(jdbc.queryForList("SELECT version FROM flyway_schema_history WHERE success = TRUE", String.class))
                .contains("1", "2");
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
        mockMvc.perform(get("/actuator/info")).andExpect(status().is4xxClientError());
        mockMvc.perform(get("/actuator/beans")).andExpect(status().is4xxClientError());
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
