package com.rms.resident.auth;

import com.rms.resident.common.config.RmsProperties;
import com.rms.resident.common.enums.Role;
import com.rms.resident.user.UserAccount;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;

@Service
public class JwtService {
    public static final String ISSUER = "rms";
    public static final String ROLE_CLAIM = "role";
    public static final Duration ACCESS_TOKEN_TTL = Duration.ofMinutes(60);
    private final SecretKey signingKey;
    private final Clock clock;

    public JwtService(RmsProperties properties, Clock clock) {
        this.signingKey = Keys.hmacShaKeyFor(properties.jwtSecret().getBytes(StandardCharsets.UTF_8));
        this.clock = clock;
    }

    public IssuedToken issue(UserAccount user) {
        return issue(user.getId(), user.getRole());
    }

    public IssuedToken issue(long userId, Role role) {
        Instant issuedAt = clock.instant();
        Instant expiresAt = issuedAt.plus(ACCESS_TOKEN_TTL);
        String token = Jwts.builder()
                .issuer(ISSUER)
                .subject(Long.toString(userId))
                .claim(ROLE_CLAIM, role.name())
                .issuedAt(Date.from(issuedAt))
                .expiration(Date.from(expiresAt))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
        return new IssuedToken(token, expiresAt);
    }

    public TokenClaims parse(String compactToken) {
        var parsed = Jwts.parser()
                .verifyWith(signingKey)
                .clock(() -> Date.from(clock.instant()))
                .build()
                .parseSignedClaims(compactToken);
        if (!"HS256".equals(parsed.getHeader().getAlgorithm())) {
            throw new MalformedJwtException("Unsupported JWT algorithm");
        }
        Claims claims = parsed.getPayload();
        if (!ISSUER.equals(claims.getIssuer()) || claims.getSubject() == null
                || claims.getIssuedAt() == null || claims.getExpiration() == null) {
            throw new MalformedJwtException("Required JWT claims are missing or invalid");
        }
        String roleClaim = claims.get(ROLE_CLAIM, String.class);
        if (roleClaim == null) {
            throw new MalformedJwtException("Required JWT role claim is missing");
        }
        try {
            long userId = Long.parseLong(claims.getSubject());
            Role role = Role.valueOf(roleClaim);
            if (userId <= 0 || claims.getIssuedAt().toInstant().isAfter(clock.instant())) {
                throw new MalformedJwtException("Required JWT claims are invalid");
            }
            return new TokenClaims(userId, role);
        } catch (IllegalArgumentException ex) {
            throw new MalformedJwtException("JWT subject or role claim is invalid", ex);
        }
    }

    public record IssuedToken(String value, Instant expiresAt) {}
    public record TokenClaims(long userId, Role role) {}
}
