package com.rms.resident.request;

import com.rms.resident.common.enums.RequestStatus;
import java.time.Clock;
import java.time.LocalDate;
import java.util.Set;

public final class OverdueRule {
    private static final Set<RequestStatus> OPEN = Set.of(RequestStatus.PENDING, RequestStatus.IN_PROGRESS);
    private OverdueRule() {}
    public static Condition today(Clock clock) { return new Condition(LocalDate.now(clock)); }
    public static boolean isOverdue(LocalDate expectedDate, RequestStatus status, LocalDate today) {
        return OPEN.contains(status) && expectedDate.isBefore(today);
    }
    public record Condition(LocalDate today) {
        public boolean matches(LocalDate expectedDate, RequestStatus status) {
            return OverdueRule.isOverdue(expectedDate, status, today);
        }
        public Set<RequestStatus> openStatuses() { return OPEN; }
    }
}
