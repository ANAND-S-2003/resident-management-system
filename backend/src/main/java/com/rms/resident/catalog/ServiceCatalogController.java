package com.rms.resident.catalog;

import com.rms.resident.common.enums.Role;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.user.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import jakarta.validation.constraints.Min;

@RestController
@RequestMapping("/api/v1/services")
public class ServiceCatalogController {
    private final ServiceCatalogService service;
    public ServiceCatalogController(ServiceCatalogService service) { this.service = service; }

    @GetMapping
    PageResponse<ServiceResponse> list(@AuthenticationPrincipal AuthenticatedUser actor,
            @RequestParam(required = false) String active, @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "0") @Min(0) int page, @RequestParam(required = false) Integer size,
            @RequestParam(required = false) String sort) { return service.list(actor, active, q, page, size, sort); }

    @PostMapping @PreAuthorize("hasAnyAuthority(T(com.rms.resident.common.enums.Role).ADMIN_AUTHORITY,T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
    ResponseEntity<ServiceResponse> create(@AuthenticationPrincipal AuthenticatedUser actor, @Valid @RequestBody ServiceWriteRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(actor, body));
    }
    @GetMapping("/{serviceId}")
    ServiceResponse get(@AuthenticationPrincipal AuthenticatedUser actor, @PathVariable Long serviceId) { return service.get(actor, serviceId); }

    @PutMapping("/{serviceId}")
    @PreAuthorize("hasAnyAuthority(T(com.rms.resident.common.enums.Role).ADMIN_AUTHORITY,T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
    ServiceResponse update(@PathVariable Long serviceId, @Valid @RequestBody ServiceWriteRequest body) { return service.update(serviceId, body); }

    @PatchMapping("/{serviceId}/activation")
    @PreAuthorize("hasAnyAuthority(T(com.rms.resident.common.enums.Role).ADMIN_AUTHORITY,T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
    ServiceResponse activation(@PathVariable Long serviceId, @Valid @RequestBody ServiceActivationRequest body) {
        return service.activate(serviceId, body.active());
    }
}
