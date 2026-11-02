package com.rms.resident.request;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

public interface ServiceRequestRepository extends JpaRepository<ServiceRequest, Long>, JpaSpecificationExecutor<ServiceRequest> {
    interface StatusCount { com.rms.resident.common.enums.RequestStatus getStatus(); long getTotal(); }
    @Query("select r.status as status, count(r) as total from ServiceRequest r group by r.status")
    List<StatusCount> countGroupedByStatus();
}
