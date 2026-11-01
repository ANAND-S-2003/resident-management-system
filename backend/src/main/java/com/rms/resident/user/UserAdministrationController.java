package com.rms.resident.user;

import com.rms.resident.auth.UserResponse;
import com.rms.resident.common.enums.Role;
import com.rms.resident.common.paging.PageResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/api/v1/users")
@PreAuthorize("hasAnyAuthority(T(com.rms.resident.common.enums.Role).ADMIN_AUTHORITY,T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
public class UserAdministrationController {
    private final UserAdministrationService service;
    public UserAdministrationController(UserAdministrationService service) { this.service = service; }

    @GetMapping
    PageResponse<UserListItemResponse> list(@AuthenticationPrincipal AuthenticatedUser actor,
            @RequestParam(required = false) Role role, @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) String q, @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(required = false) Integer size, @RequestParam(required = false) String sort) {
        return service.list(actor, role, active, q, page, size, sort);
    }
    @PostMapping
    ResponseEntity<UserResponse> create(@AuthenticationPrincipal AuthenticatedUser actor,
                                          @Valid @RequestBody UserCreateRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(actor, body));
    }
    @GetMapping("/{userId}")
    UserAdminResponse get(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long userId) {
        return service.get(actor, userId);
    }
    @PutMapping("/{userId}")
    UserAdminResponse update(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long userId,
                             @Valid @RequestBody UserUpdateRequest body) { return service.update(actor, userId, body); }
    @PatchMapping("/{userId}/activation")
    UserResponse activation(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long userId,
                            @Valid @RequestBody ActivationRequest body) {
        return service.activate(actor, userId, body.active());
    }
}
