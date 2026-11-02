package com.rms.resident.request;

import org.springframework.data.jpa.domain.Specification;

/** Shared database predicate for the computed overdue rule. */
public final class RequestSpecifications {
    private RequestSpecifications() {}
    public static Specification<ServiceRequest> overdue(OverdueRule.Condition condition) {
        return (root, query, cb) -> cb.and(
                cb.lessThan(root.<java.time.LocalDate>get("expectedCompletionDate"), condition.today()),
                root.get("status").in(condition.openStatuses()));
    }
}
