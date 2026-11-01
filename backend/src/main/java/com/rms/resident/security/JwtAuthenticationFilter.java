package com.rms.resident.security;

import com.rms.resident.auth.JwtService;
import com.rms.resident.common.error.ErrorCode;
import com.rms.resident.common.ratelimit.ClientIpResolver;
import com.rms.resident.common.ratelimit.RateLimiter;
import com.rms.resident.user.AuthenticatedUser;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import io.jsonwebtoken.JwtException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final Pattern BEARER = Pattern.compile("(?i)^Bearer\\s+(.+)$");
    private static final String REGISTER_PATH = "/api/v1/auth/register";
    private static final Duration REGISTER_WINDOW = Duration.ofHours(1);
    private static final int REGISTER_LIMIT = 10;

    private final JwtService jwtService;
    private final UserAccountRepository users;
    private final SecurityErrorWriter errorWriter;
    private final RateLimiter rateLimiter;
    private final ClientIpResolver clientIpResolver;

    public JwtAuthenticationFilter(JwtService jwtService, UserAccountRepository users, SecurityErrorWriter errorWriter,
                                   RateLimiter rateLimiter, ClientIpResolver clientIpResolver) {
        this.jwtService = jwtService;
        this.users = users;
        this.errorWriter = errorWriter;
        this.rateLimiter = rateLimiter;
        this.clientIpResolver = clientIpResolver;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getRequestURI().startsWith("/api/")) response.setHeader("Cache-Control", "no-store");
        String authorization = request.getHeader("Authorization");
        if (authorization != null && authorization.regionMatches(true, 0, "Bearer", 0, 6)) {
            Matcher matcher = BEARER.matcher(authorization.trim());
            if (!matcher.matches() || !authenticate(matcher.group(1).trim(), request, response)) return;
        }

        if ("POST".equals(request.getMethod()) && REGISTER_PATH.equals(request.getRequestURI())) {
            String key = "register:" + clientIpResolver.resolve(request);
            RateLimiter.Decision decision = rateLimiter.tryAcquire(key, REGISTER_LIMIT, REGISTER_WINDOW);
            if (!decision.allowed()) {
                response.setHeader("Retry-After", Long.toString(decision.retryAfterSeconds()));
                errorWriter.write(request, response, ErrorCode.TOO_MANY_REQUESTS, "Registration rate limit exceeded");
                return;
            }
        }
        chain.doFilter(request, response);
    }

    private boolean authenticate(String token, HttpServletRequest request, HttpServletResponse response) throws IOException {
        JwtService.TokenClaims claims;
        try {
            claims = jwtService.parse(token);
        } catch (JwtException | IllegalArgumentException exception) {
            errorWriter.write(request, response, ErrorCode.UNAUTHENTICATED, "Authentication is required or the token is invalid");
            return false;
        }
        UserAccount user = users.findById(claims.userId()).orElse(null);
        if (user == null || !user.isActive() || user.getRole() != claims.role()) {
            errorWriter.write(request, response, ErrorCode.UNAUTHENTICATED, "Authentication is required or the token is invalid");
            return false;
        }
        AuthenticatedUser principal = new AuthenticatedUser(user.getId(), user.getEmail(), user.getRole());
        var authentication = new UsernamePasswordAuthenticationToken(principal, null,
                List.of(new SimpleGrantedAuthority(user.getRole().authority())));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        return true;
    }
}
