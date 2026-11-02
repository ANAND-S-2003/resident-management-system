package com.rms.resident.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ResidentNotificationRepository extends JpaRepository<ResidentNotification, Long>, JpaSpecificationExecutor<ResidentNotification> {
    long countByRecipientIdAndReadFalse(Long recipientId);
    @Modifying @Query("update ResidentNotification n set n.read = true, n.readAt = :now where n.recipientId = :userId and n.read = false")
    int markAllRead(@Param("userId") Long userId, @Param("now") java.time.Instant now);
}
