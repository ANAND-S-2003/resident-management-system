package com.rms.resident.dashboard;

import com.rms.resident.common.enums.RequestStatus;
import java.util.Map;

public final class DashboardDtos {
    private DashboardDtos() {}
    public record AdminSummary(Map<RequestStatus, Long> byStatus, long overdueCount, long totalRequests, long activeResidents) {}
    public record SuperAdminSummary(Map<RequestStatus, Long> byStatus, long overdueCount, long totalRequests,
                                    long activeResidents, long activeAdmins) {}
}
