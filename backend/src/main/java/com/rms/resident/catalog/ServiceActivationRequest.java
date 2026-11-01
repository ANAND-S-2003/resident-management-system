package com.rms.resident.catalog;

import jakarta.validation.constraints.NotNull;

public record ServiceActivationRequest(@NotNull Boolean active) {}
