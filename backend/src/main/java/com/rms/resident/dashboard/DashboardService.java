package com.rms.resident.dashboard;

import com.rms.resident.common.enums.RequestStatus;
import com.rms.resident.common.enums.Role;
import com.rms.resident.request.OverdueRule;
import com.rms.resident.request.RequestSpecifications;
import com.rms.resident.request.ServiceRequestRepository;
import com.rms.resident.user.UserAccountRepository;
import com.rms.resident.user.AuthenticatedUser;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Clock;
import java.util.EnumMap;
import java.util.Map;

@Service
public class DashboardService {
    private final ServiceRequestRepository requests;
    private final UserAccountRepository users;
    private final Clock clock;
    public DashboardService(ServiceRequestRepository requests, UserAccountRepository users, Clock clock) {
        this.requests=requests; this.users=users; this.clock=clock;
    }

    @Transactional(readOnly = true)
    public Object summary(AuthenticatedUser actor) {
        Map<RequestStatus,Long> counts=new EnumMap<>(RequestStatus.class);
        for(RequestStatus status:RequestStatus.values()) counts.put(status,0L);
        for(var row:requests.countGroupedByStatus()) counts.put(row.getStatus(),row.getTotal());
        long total=counts.values().stream().mapToLong(Long::longValue).sum();
        long overdue=requests.count(RequestSpecifications.overdue(OverdueRule.today(clock)));
        long activeResidents=users.countByRoleAndActiveTrue(Role.USER);
        Map<RequestStatus,Long> immutable=java.util.Collections.unmodifiableMap(new EnumMap<>(counts));
        if(actor.role()==Role.SUPER_ADMIN)
            return new DashboardDtos.SuperAdminSummary(immutable,overdue,total,activeResidents,users.countByRoleAndActiveTrue(Role.ADMIN));
        return new DashboardDtos.AdminSummary(immutable,overdue,total,activeResidents);
    }
}
