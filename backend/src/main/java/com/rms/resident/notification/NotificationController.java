package com.rms.resident.notification;

import com.rms.resident.common.enums.Role;
import com.rms.resident.common.paging.PageResponse;
import com.rms.resident.user.AuthenticatedUser;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import static com.rms.resident.notification.NotificationDtos.*;

@RestController @RequestMapping("/api/v1/notifications")
public class NotificationController {
    private final NotificationService service;
    public NotificationController(NotificationService service){this.service=service;}
    @GetMapping @PreAuthorize("hasAuthority(T(com.rms.resident.common.enums.Role).USER_AUTHORITY)")
    PageResponse<Response> list(@AuthenticationPrincipal AuthenticatedUser actor,@RequestParam(required=false) Boolean unreadOnly,
            @RequestParam(required=false) Integer page,@RequestParam(required=false) Integer size,@RequestParam(required=false) String sort){
        return service.list(actor,unreadOnly,page,size,sort);
    }
    @GetMapping("/unread-count") @PreAuthorize("hasAuthority(T(com.rms.resident.common.enums.Role).USER_AUTHORITY)")
    UnreadCount unreadCount(@AuthenticationPrincipal AuthenticatedUser actor){return service.unreadCount(actor);}
    @PatchMapping("/{notificationId}/read") @PreAuthorize("hasAuthority(T(com.rms.resident.common.enums.Role).USER_AUTHORITY)")
    ReadResponse read(@AuthenticationPrincipal AuthenticatedUser actor,@PathVariable Long notificationId,@Valid @RequestBody ReadRequest body){return service.read(actor,notificationId);}
    @PatchMapping("/read-all") @PreAuthorize("hasAuthority(T(com.rms.resident.common.enums.Role).USER_AUTHORITY)")
    ResponseEntity<Void> readAll(@AuthenticationPrincipal AuthenticatedUser actor){service.readAll(actor);return ResponseEntity.noContent().build();}
}
