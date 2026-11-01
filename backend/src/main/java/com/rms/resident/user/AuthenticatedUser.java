package com.rms.resident.user;

import com.rms.resident.common.enums.Role;

public record AuthenticatedUser(Long id, String email, Role role) {}
