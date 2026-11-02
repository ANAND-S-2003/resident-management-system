package com.rms.resident.request;

import com.rms.resident.common.enums.RequestStatus;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import com.rms.resident.common.validation.CodePointSize;
import java.time.Instant;
import java.time.LocalDate;

public final class RequestDtos {
    private RequestDtos() {}
    public record Create(@NotNull Long serviceId, @NotBlank @CodePointSize(min=5,max=1000) String description,
                         @NotNull LocalDate expectedCompletionDate) {
        public Create { if (description != null) description = description.trim(); }
    }
    public record Update(RequestStatus status, @CodePointSize(max=1000) String adminRemarks) {
        public Update { if (adminRemarks != null) adminRemarks = adminRemarks.trim(); }
        @jakarta.validation.constraints.AssertTrue(message="At least one of status or adminRemarks is required")
        public boolean hasUpdate() { return status != null || adminRemarks != null; }
    }
    public record Person(Long id, String fullName) {}
    public record Service(Long id, String name) {}
    public record Response(Long id, Person resident, String flatNumber, Service service, String description,
                           LocalDate requestDate, LocalDate expectedCompletionDate, RequestStatus status,
                           String adminRemarks, Long version, boolean overdue, Instant createdAt, Instant updatedAt) {}
    public record History(RequestStatus fromStatus, RequestStatus toStatus, Person changedBy, String remarks, Instant createdAt) {}
}
