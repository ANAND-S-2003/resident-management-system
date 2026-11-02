package com.rms.resident.user;

import com.rms.resident.common.enums.Role;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

import java.util.Optional;
import java.util.List;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long>, JpaSpecificationExecutor<UserAccount> {
    Optional<UserAccount> findByEmail(String email);
    boolean existsByRole(Role role);
    List<UserAccount> findByRole(Role role);
    long countByRoleAndActiveTrue(Role role);
}
