package com.rms.resident.contact;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface ContactQueryRepository extends JpaRepository<ContactQuery, Long>, JpaSpecificationExecutor<ContactQuery> {}
