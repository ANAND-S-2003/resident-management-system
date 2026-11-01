package com.rms.resident.integration;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.testcontainers.mysql.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

final class SharedMySqlContainer {
    private static final MySQLContainer MYSQL = new MySQLContainer(DockerImageName.parse("mysql:8.4"))
            .withDatabaseName("rms")
            .withUsername("rms_test")
            .withPassword("rms_test_password");

    private SharedMySqlContainer() {}

    static synchronized MySQLContainer get() {
        if (!MYSQL.isRunning()) MYSQL.start();
        return MYSQL;
    }

    static void registerProperties(DynamicPropertyRegistry registry) {
        MySQLContainer mysql = get();
        registry.add("spring.datasource.url", () -> {
            String url = mysql.getJdbcUrl();
            return url + (url.contains("?") ? "&" : "?")
                    + "connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true";
        });
        registry.add("spring.datasource.username", mysql::getUsername);
        registry.add("spring.datasource.password", mysql::getPassword);
        registry.add("rms.jwt-secret", () -> AuthenticationIT.TEST_JWT_SECRET);
        registry.add("rms.superadmin-email", () -> "root@example.test");
        registry.add("rms.superadmin-name", () -> "Test Super Admin");
        registry.add("rms.superadmin-password", () -> "TestPassword123");
        registry.add("rms.timezone", () -> "Asia/Kolkata");
        registry.add("rms.cors-allowed-origins", () -> "http://localhost:5173");
        registry.add("rms.trust-proxy", () -> "false");
    }
}
