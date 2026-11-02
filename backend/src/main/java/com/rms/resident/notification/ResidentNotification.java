package com.rms.resident.notification;

import com.rms.resident.common.enums.NotificationType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "notifications")
public class ResidentNotification {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "recipient_id", nullable = false)
    private Long recipientId;
    @Column(name = "request_id", nullable = false)
    private Long requestId;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 40)
    private NotificationType type;
    @Column(nullable = false, length = 500)
    private String message;
    @Column(name = "is_read", nullable = false)
    private boolean read;
    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant createdAt;
    @Column(name = "read_at", columnDefinition = "DATETIME(6)")
    private Instant readAt;

    protected ResidentNotification() {}
    public static ResidentNotification create(Long recipientId, Long requestId, NotificationType type,
                                               String message, Instant createdAt) {
        ResidentNotification value = new ResidentNotification(); value.recipientId = recipientId;
        value.requestId = requestId; value.type = type; value.message = message;
        value.read = false; value.createdAt = createdAt; return value;
    }
    public void markRead(Instant now) { if (!read) { read = true; readAt = now; } }
    public Long getId() { return id; } public Long getRecipientId() { return recipientId; }
    public Long getRequestId() { return requestId; } public NotificationType getType() { return type; }
    public String getMessage() { return message; } public boolean isRead() { return read; }
    public Instant getCreatedAt() { return createdAt; } public Instant getReadAt() { return readAt; }
}
