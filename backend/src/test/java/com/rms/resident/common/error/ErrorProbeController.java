package com.rms.resident.common.error;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class ErrorProbeController {
    @GetMapping("/__test/error/{code}")
    void error(@PathVariable ErrorCode code) {
        throw new ApiException(code, "controlled error");
    }

    @PostMapping(value = "/__test/body", consumes = MediaType.APPLICATION_JSON_VALUE)
    void body(@Valid @RequestBody ProbeBody body) {}

    @GetMapping("/__test/typed")
    int typed(@RequestParam int count) {
        return count;
    }

    @GetMapping("/__test/minimum")
    int minimum(@RequestParam @Min(1) int value) {
        return value;
    }

    @GetMapping("/__test/optimistic")
    void optimistic() {
        throw new OptimisticLockingFailureException("secret detail");
    }

    @GetMapping("/__test/boom")
    void boom() {
        throw new IllegalStateException("secret detail");
    }

    @GetMapping("/__test/access-denied")
    void accessDenied() {
        throw new AccessDeniedException("secret authorization rule detail");
    }

    @GetMapping("/__test/authentication-failure")
    void authenticationFailure() {
        throw new BadCredentialsException("secret authentication detail");
    }

    @PostMapping("/__test/post-only")
    void postOnly() {}

    public record ProbeBody(@NotBlank String name) {}
}
