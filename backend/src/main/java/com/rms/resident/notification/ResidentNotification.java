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
}
