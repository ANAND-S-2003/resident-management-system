package com.rms.resident.notification;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public final class NotificationDtos {
    private NotificationDtos() {}
    public record Response(Long id, Long requestId, String type, String message, boolean read, Instant createdAt, Instant readAt) {}
    public record ReadResponse(Long id, boolean read, Instant readAt) {}
    public record ReadRequest(@NotNull @AssertTrue(message="read must be true") Boolean read) {}
    public record UnreadCount(long count) {}
}
