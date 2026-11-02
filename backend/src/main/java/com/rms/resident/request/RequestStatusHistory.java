package com.rms.resident.request;

import com.rms.resident.common.enums.RequestStatus;
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
@Table(name = "request_status_history")
public class RequestStatusHistory {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "request_id", nullable = false)
    private Long requestId;
    @Enumerated(EnumType.STRING) @Column(name = "from_status", length = 20)
    private RequestStatus fromStatus;
    @Enumerated(EnumType.STRING) @Column(name = "to_status", nullable = false, length = 20)
    private RequestStatus toStatus;
    @Column(name = "changed_by", nullable = false)
    private Long changedBy;
    @Column(columnDefinition = "TEXT")
    private String remarks;
    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant createdAt;

    protected RequestStatusHistory() {}
    public static RequestStatusHistory create(Long requestId, RequestStatus from, RequestStatus to,
                                               Long changedBy, String remarks, Instant createdAt) {
        RequestStatusHistory value = new RequestStatusHistory(); value.requestId = requestId;
        value.fromStatus = from; value.toStatus = to; value.changedBy = changedBy;
        value.remarks = remarks; value.createdAt = createdAt; return value;
    }
    public Long getId() { return id; } public Long getRequestId() { return requestId; }
    public RequestStatus getFromStatus() { return fromStatus; } public RequestStatus getToStatus() { return toStatus; }
    public Long getChangedBy() { return changedBy; } public String getRemarks() { return remarks; }
    public Instant getCreatedAt() { return createdAt; }
}
