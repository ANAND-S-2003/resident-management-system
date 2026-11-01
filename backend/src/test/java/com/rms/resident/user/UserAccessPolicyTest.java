package com.rms.resident.user;

import com.rms.resident.common.enums.Role;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class UserAccessPolicyTest {
    private final UserAccessPolicy policy = new UserAccessPolicy();
    @Test void completeActorTargetOperationMatrix() {
        for (Role actor : Role.values()) for (Role target : Role.values())
            for (UserAccessPolicy.Operation op : UserAccessPolicy.Operation.values()) {
                boolean expected = target != Role.SUPER_ADMIN &&
                        (actor == Role.ADMIN ? target == Role.USER : actor == Role.SUPER_ADMIN);
                assertThat(policy.may(actor, target, op)).as("%s %s %s", actor, op, target).isEqualTo(expected);
            }
    }
}
