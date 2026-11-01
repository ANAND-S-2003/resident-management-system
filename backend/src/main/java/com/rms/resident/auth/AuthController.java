package com.rms.resident.auth;

import com.rms.resident.user.AuthenticatedUser;
import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
    private final AuthService authService;

    public AuthController(AuthService authService) { this.authService = authService; }

    @PostMapping("/register")
    ResponseEntity<UserResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(request));
    }

    @PostMapping("/login")
    LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest servletRequest,
                        HttpServletResponse response) {
        try {
            return authService.login(request, servletRequest);
        } catch (AuthService.RateLimitException exception) {
            response.setHeader("Retry-After", Long.toString(exception.retryAfterSeconds()));
            throw new ApiException(ErrorCode.TOO_MANY_REQUESTS, "Login rate limit exceeded");
        }
    }

    @GetMapping("/me")
    UserResponse me(@AuthenticationPrincipal AuthenticatedUser principal) {
        return authService.currentUser(principal);
    }

    @PostMapping("/change-password")
    ResponseEntity<Void> changePassword(@AuthenticationPrincipal AuthenticatedUser principal,
                                        @Valid @RequestBody ChangePasswordRequest request) {
        authService.changePassword(principal, request);
        return ResponseEntity.noContent().build();
    }
}
