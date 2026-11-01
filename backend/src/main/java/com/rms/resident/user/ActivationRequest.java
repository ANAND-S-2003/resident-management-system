package com.rms.resident.user;

import jakarta.validation.constraints.NotNull;

public record ActivationRequest(@NotNull Boolean active) {}
