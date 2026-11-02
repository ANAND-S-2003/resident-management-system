package com.rms.resident.contact;

import com.rms.resident.common.enums.Role;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.common.ratelimit.ClientIpResolver;
import com.rms.resident.user.AuthenticatedUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/contact-queries")
public class ContactQueryController {
    private final ContactQueryService service;
    private final ClientIpResolver clientIpResolver;
    public ContactQueryController(ContactQueryService service,ClientIpResolver clientIpResolver) {
        this.service=service; this.clientIpResolver=clientIpResolver;
    }
    @PostMapping
    ResponseEntity<ContactDtos.Created> submit(@Valid @RequestBody ContactDtos.CreateRequest body,
            @AuthenticationPrincipal AuthenticatedUser actor,HttpServletRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.submit(body,actor,clientIpResolver.resolve(request)));
    }
    @GetMapping
    @PreAuthorize("hasAnyAuthority(T(com.rms.resident.common.enums.Role).ADMIN_AUTHORITY,T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
    PageResponse<ContactDtos.Response> list(@RequestParam(required=false) Integer page,@RequestParam(required=false) Integer size,
                                            @RequestParam(required=false) String sort) { return service.list(page,size,sort); }
    @GetMapping("/{queryId}")
    @PreAuthorize("hasAnyAuthority(T(com.rms.resident.common.enums.Role).ADMIN_AUTHORITY,T(com.rms.resident.common.enums.Role).SUPER_ADMIN_AUTHORITY)")
    ContactDtos.Response get(@PathVariable Long queryId) { return service.get(queryId); }
}
