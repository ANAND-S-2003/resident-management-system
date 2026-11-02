package com.rms.resident.request;

import com.rms.resident.common.enums.Role;
import com.rms.resident.common.enums.RequestStatus;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.user.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import java.util.List;
import static com.rms.resident.request.RequestDtos.*;

@RestController
@RequestMapping("/api/v1/requests")
public class RequestController {
    private final RequestService service;
    public RequestController(RequestService service) { this.service=service; }
    @GetMapping @PreAuthorize("isAuthenticated()")
    PageResponse<Response> list(@AuthenticationPrincipal AuthenticatedUser actor,
            @RequestParam(required=false) RequestStatus status,@RequestParam(required=false) Boolean overdue,
            @RequestParam(required=false) String q,@RequestParam(required=false) Integer page,
            @RequestParam(required=false) Integer size,@RequestParam(required=false) String sort) {
        return service.list(actor,status,overdue,q,page,size,sort);
    }
    @PostMapping @PreAuthorize("hasAuthority(T(com.rms.resident.common.enums.Role).USER_AUTHORITY)")
    ResponseEntity<Response> create(@AuthenticationPrincipal AuthenticatedUser actor,@Valid @RequestBody Create body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(actor,body));
    }
    @GetMapping("/{requestId}") @PreAuthorize("isAuthenticated()")
    Response get(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable Long requestId) { return service.get(actor,requestId); }
    @GetMapping("/{requestId}/history") @PreAuthorize("isAuthenticated()")
    List<History> history(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable Long requestId,
            @RequestParam(required=false) String sort) { return service.history(actor,requestId,sort); }
    @PatchMapping("/{requestId}") @PreAuthorize("hasAnyAuthority(T(com.rms.resident.common.enums.Role).ADMIN_AUTHORITY,T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
    Response update(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable Long requestId,@Valid @RequestBody Update body) {
        return service.update(actor,requestId,body);
    }
}
