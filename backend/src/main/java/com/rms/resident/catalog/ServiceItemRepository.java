package com.rms.resident.catalog;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ServiceItemRepository extends JpaRepository<ServiceItem, Long>, JpaSpecificationExecutor<ServiceItem> {}
