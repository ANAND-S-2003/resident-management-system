package com.rms.resident.auth;

import com.rms.resident.common.config.RmsProperties;
import com.rms.resident.common.enums.Role;
import com.rms.resident.user.UserAccount;
import com.rms.resident.user.UserAccountRepository;
import org.junit.jupiter.api.Test;
import org.springframework.boot.DefaultApplicationArguments;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Clock;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class SuperAdminBootstrapTest {
    @Test
    void createsOnlyWhenNoSuperAdminExistsAndIsIdempotent() {
        UserAccountRepository users = mock(UserAccountRepository.class);
        PasswordEncoder encoder = mock(PasswordEncoder.class);
        RmsProperties properties = new RmsProperties("jwt-secret-that-is-at-least-32-bytes", "root@example.test",
                "Root Admin", "Bootstrap123", "Asia/Kolkata", List.of(), false);
        when(users.existsByRole(Role.SUPER_ADMIN)).thenReturn(false, true);
        when(encoder.encode("Bootstrap123")).thenReturn("encoded-password");
        when(users.saveAndFlush(any(UserAccount.class))).thenAnswer(invocation -> invocation.getArgument(0));
        SuperAdminBootstrap bootstrap = new SuperAdminBootstrap(users, properties, encoder, Clock.systemUTC());

        bootstrap.run(new DefaultApplicationArguments(new String[0]));
        bootstrap.run(new DefaultApplicationArguments(new String[0]));

        verify(users, times(1)).saveAndFlush(argThat(user -> user.getRole() == Role.SUPER_ADMIN
                && user.getEmail().equals("root@example.test") && user.getFullName().equals("Root Admin")
                && user.getPasswordHash().equals("encoded-password")));
    }
}
