package com.rms.resident.dashboard;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.rms.resident.common.enums.RequestStatus;
import org.junit.jupiter.api.Test;
import java.util.EnumMap;
import java.util.HashSet;
import static org.assertj.core.api.Assertions.assertThat;

class DashboardDtosTest {
    private final ObjectMapper mapper=new ObjectMapper();
    @Test void adminSummaryAlwaysHasAllStatusesAndOmitsActiveAdmins() throws Exception {
        var counts=new EnumMap<RequestStatus,Long>(RequestStatus.class);
        for(var status:RequestStatus.values()) counts.put(status,0L);
        counts.put(RequestStatus.PENDING,2L);
        var json=mapper.readTree(mapper.writeValueAsString(new DashboardDtos.AdminSummary(counts,1,2,3)));
        var keys=new HashSet<String>(); json.path("byStatus").fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("PENDING","IN_PROGRESS","COMPLETED","REJECTED");
        assertThat(json.has("activeAdmins")).isFalse();
    }
    @Test void superAdminSummaryIncludesActiveAdminsAndAllStatuses() throws Exception {
        var counts=new EnumMap<RequestStatus,Long>(RequestStatus.class);
        for(var status:RequestStatus.values()) counts.put(status,0L);
        var json=mapper.readTree(mapper.writeValueAsString(new DashboardDtos.SuperAdminSummary(counts,0,0,0,4)));
        var keys=new HashSet<String>(); json.path("byStatus").fieldNames().forEachRemaining(keys::add);
        assertThat(keys).containsExactlyInAnyOrder("PENDING","IN_PROGRESS","COMPLETED","REJECTED");
        assertThat(json.path("activeAdmins").asLong()).isEqualTo(4);
    }
}
