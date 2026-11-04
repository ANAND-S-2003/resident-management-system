package com.rms.resident.auth;

import com.rms.resident.common.config.RmsProperties;
import com.rms.resident.common.enums.Role;
import com.rms.resident.common.time.MutableClock;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.Date;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {
    private static final String SECRET = "test-secret-longer-than-thirty-two-bytes-keep-it-safe";
    private static final Instant NOW = Instant.parse("2026-01-01T00:00:00Z");
    private final MutableClock clock = new MutableClock(NOW, ZoneOffset.UTC);
    private final JwtService service = service(SECRET, clock);

    @Test void issuesAndParsesValidHs256TokenWithExpectedClaims() {
        JwtService.IssuedToken issued = service.issue(73L, Role.USER);
        assertThat(issued.expiresAt()).isEqualTo(NOW.plusSeconds(3600));
        assertThat(service.parse(issued.value())).isEqualTo(new JwtService.TokenClaims(73L, Role.USER));
    }

    @Test void rejectsExpiredToken() {
        String token = service.issue(1L, Role.ADMIN).value();
        clock.advance(java.time.Duration.ofMinutes(61));
        assertThatThrownBy(() -> service.parse(token)).isInstanceOf(JwtException.class);
    }

    @Test void rejectsTamperedToken() {
        String token = service.issue(1L, Role.USER).value();
        String[] parts = token.split("\\.");
        parts[2] = (parts[2].charAt(0) == 'a' ? "b" : "a") + parts[2].substring(1);
        assertThatThrownBy(() -> service.parse(String.join(".", parts))).isInstanceOf(JwtException.class);
    }

    @Test void rejectsTokenSignedWithAnotherKey() {
        String token = service.issue(1L, Role.USER).value();
        assertThatThrownBy(() -> service("another-secret-that-is-definitely-over-32-bytes", clock).parse(token))
                .isInstanceOf(JwtException.class);
    }

    @Test void rejectsUnsecuredNoneAlgorithm() {
        String header = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"alg\":\"none\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String payload = Base64.getUrlEncoder().withoutPadding()
                .encodeToString("{\"iss\":\"rms\",\"sub\":\"1\",\"role\":\"USER\"}".getBytes(StandardCharsets.UTF_8));
        assertThatThrownBy(() -> service.parse(header + "." + payload + "."))
                .isInstanceOf(JwtException.class);
    }

    @Test void rejectsSignedTokenUsingAnAlgorithmOtherThanHs256() {
        var key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder().issuer(JwtService.ISSUER).subject("1").claim("role", "USER")
                .issuedAt(Date.from(NOW)).expiration(Date.from(NOW.plusSeconds(3600)))
                .signWith(key, Jwts.SIG.HS384).compact();
        assertThatThrownBy(() -> service.parse(token)).isInstanceOf(MalformedJwtException.class);
    }

    @Test void rejectsTokenMissingRequiredRoleClaim() {
        var key = Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8));
        String token = Jwts.builder().issuer(JwtService.ISSUER).subject("1")
                .issuedAt(Date.from(NOW)).expiration(Date.from(NOW.plusSeconds(3600)))
                .signWith(key, Jwts.SIG.HS256).compact();
        assertThatThrownBy(() -> service.parse(token)).isInstanceOf(MalformedJwtException.class);
    }

    private static JwtService service(String secret, MutableClock clock) {
        return new JwtService(new RmsProperties(secret, "root@example.test", "Test Admin", "TestPassword123",
                "UTC", List.of(), false, 5, 10, 5), clock);
    }
}
