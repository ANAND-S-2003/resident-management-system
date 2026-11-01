package com.rms.resident.auth;

import com.rms.resident.common.config.RmsProperties;
import com.rms.resident.common.enums.Role;
import com.rms.resident.common.validation.PasswordPolicy;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;

@Component
public class SuperAdminBootstrap implements ApplicationRunner {
    private static final Logger log = LoggerFactory.getLogger(SuperAdminBootstrap.class);
    private final UserAccountRepository users;
    private final RmsProperties properties;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    public SuperAdminBootstrap(UserAccountRepository users, RmsProperties properties,
                               PasswordEncoder passwordEncoder, Clock clock) {
        this.users = users;
        this.properties = properties;
        this.passwordEncoder = passwordEncoder;
        this.clock = clock;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (!PasswordPolicy.isValid(properties.superadminPassword())) {
            throw new IllegalStateException("RMS_SUPERADMIN_PASSWORD does not meet the documented password policy");
        }
        if (users.existsByRole(Role.SUPER_ADMIN)) return;
        UserAccount account = UserAccount.create(properties.superadminName(), properties.superadminEmail(),
                passwordEncoder.encode(properties.superadminPassword()), Role.SUPER_ADMIN, null, clock.instant());
        users.saveAndFlush(account);
        log.info("Created initial SUPER_ADMIN account for {}", properties.superadminEmail());
    }
}
