package com.rms.resident.auth;

import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import com.rms.resident.common.enums.Role;
import com.rms.resident.common.ratelimit.ClientIpResolver;
import com.rms.resident.common.ratelimit.RateLimiter;
import com.rms.resident.user.AuthenticatedUser;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.util.Locale;

@Service
public class AuthService {
    private static final String DUMMY_BCRYPT_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    private static final int LOGIN_LIMIT = 5;

    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;
    private final RateLimiter rateLimiter;
    private final ClientIpResolver clientIpResolver;
    private final Clock clock;

    public AuthService(UserAccountRepository users, PasswordEncoder passwordEncoder, JwtService jwtService,
                       RateLimiter rateLimiter, ClientIpResolver clientIpResolver, Clock clock) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.jwtService = jwtService;
        this.rateLimiter = rateLimiter;
        this.clientIpResolver = clientIpResolver;
        this.clock = clock;
    }

    public UserResponse register(RegisterRequest request) {
        UserAccount user = UserAccount.create(request.fullName(), request.email(),
                passwordEncoder.encode(request.password()), Role.USER, request.flatNumber(), clock.instant());
        try {
            return UserResponse.from(users.saveAndFlush(user));
        } catch (DataIntegrityViolationException exception) {
            throw new ApiException(ErrorCode.DUPLICATE_RESOURCE, "An account with this email already exists");
        }
    }

    public LoginResponse login(LoginRequest request, HttpServletRequest servletRequest) {
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        String key = "login:" + clientIpResolver.resolve(servletRequest) + ":" + email;
        RateLimiter.Decision decision = rateLimiter.tryAcquire(key, LOGIN_LIMIT, LOGIN_WINDOW);
        if (!decision.allowed()) {
            throw new RateLimitException(decision.retryAfterSeconds());
        }

        UserAccount user = users.findByEmail(email).orElse(null);
        String hash = user == null ? DUMMY_BCRYPT_HASH : user.getPasswordHash();
        boolean passwordMatches = passwordEncoder.matches(request.password(), hash);
        if (user == null || !user.isActive() || !passwordMatches) {
            throw new ApiException(ErrorCode.INVALID_CREDENTIALS, "Email or password is incorrect");
        }
        rateLimiter.reset(key);
        JwtService.IssuedToken token = jwtService.issue(user);
        return new LoginResponse(token.value(), "Bearer", token.expiresAt(), LoginUserResponse.from(user));
    }

    public UserResponse currentUser(AuthenticatedUser principal) {
        return UserResponse.from(findActivePrincipal(principal));
    }

    public void changePassword(AuthenticatedUser principal, ChangePasswordRequest request) {
        UserAccount user = findActivePrincipal(principal);
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_CURRENT_PASSWORD, "Current password did not match");
        }
        if (passwordEncoder.matches(request.newPassword(), user.getPasswordHash())) {
            throw new ApiException(ErrorCode.VALIDATION_ERROR, "New password must differ from the current password");
        }
        user.changePasswordHash(passwordEncoder.encode(request.newPassword()), clock.instant());
        users.save(user);
    }

    private UserAccount findActivePrincipal(AuthenticatedUser principal) {
        UserAccount user = users.findById(principal.id()).orElse(null);
        if (user == null || !user.isActive() || user.getRole() != principal.role()) {
            throw new ApiException(ErrorCode.UNAUTHENTICATED, "Authentication is required or the token is invalid");
        }
        return user;
    }

    public static class RateLimitException extends RuntimeException {
        private final long retryAfterSeconds;
        public RateLimitException(long retryAfterSeconds) { this.retryAfterSeconds = retryAfterSeconds; }
        public long retryAfterSeconds() { return retryAfterSeconds; }
    }
}
