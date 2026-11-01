package com.rms.resident.catalog;

import com.rms.resident.common.enums.Role;
import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ServiceVisibilityPolicyTest {
    @Test void userAlwaysGetsActiveFilterAndCannotViewInactiveService() {
        assertThat(ServiceVisibilityPolicy.activeFilter(Role.USER, null)).isTrue();
        assertThat(ServiceVisibilityPolicy.activeFilter(Role.USER, "false")).isTrue();
        assertThat(ServiceVisibilityPolicy.activeFilter(Role.USER, "garbage")).isTrue();
        assertThat(ServiceVisibilityPolicy.mayView(Role.USER, true)).isTrue();
        assertThat(ServiceVisibilityPolicy.mayView(Role.USER, false)).isFalse();
    }

    @Test void adminAndSuperAdminCanChooseActiveFilterAndSeeInactiveItems() {
        for (Role role : new Role[]{Role.ADMIN, Role.SUPER_ADMIN}) {
            assertThat(ServiceVisibilityPolicy.activeFilter(role, "true")).isTrue();
            assertThat(ServiceVisibilityPolicy.activeFilter(role, "false")).isFalse();
            assertThat(ServiceVisibilityPolicy.activeFilter(role, null)).isNull();
            assertThat(ServiceVisibilityPolicy.mayView(role, false)).isTrue();
        }
        assertThatThrownBy(() -> ServiceVisibilityPolicy.activeFilter(Role.ADMIN, "maybe"))
                .isInstanceOf(ApiException.class).extracting(ex -> ((ApiException) ex).errorCode())
                .isEqualTo(ErrorCode.VALIDATION_ERROR);
    }
}
