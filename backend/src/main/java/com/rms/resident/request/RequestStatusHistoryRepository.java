package com.rms.resident.request;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface RequestStatusHistoryRepository extends JpaRepository<RequestStatusHistory, Long> {
    List<RequestStatusHistory> findByRequestIdOrderByCreatedAtAscIdAsc(Long requestId);
}
