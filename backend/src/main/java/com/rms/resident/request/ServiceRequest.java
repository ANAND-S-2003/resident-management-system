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
import jakarta.persistence.Version;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "service_requests")
public class ServiceRequest {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "resident_id", nullable = false)
    private Long residentId;
    @Column(name = "flat_number", nullable = false, length = 30)
    private String flatNumber;
    @Column(name = "service_id", nullable = false)
    private Long serviceId;
    @Column(nullable = false, length = 1000)
    private String description;
    @Column(name = "request_date", nullable = false)
    private LocalDate requestDate;
    @Column(name = "expected_completion_date", nullable = false)
    private LocalDate expectedCompletionDate;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private RequestStatus status;
    @Column(name = "admin_remarks", length = 1000)
    private String adminRemarks;
    @Version @Column(nullable = false)
    private Long version;
    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant updatedAt;

    protected ServiceRequest() {}
}
