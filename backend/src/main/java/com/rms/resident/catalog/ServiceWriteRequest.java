package com.rms.resident.catalog;

import com.rms.resident.common.validation.CodePointSize;
import jakarta.validation.constraints.NotBlank;

public record ServiceWriteRequest(@NotBlank @CodePointSize(min = 2, max = 100) String name,
                                 @CodePointSize(max = 500) String description) {
    public ServiceWriteRequest { name = trim(name); description = trim(description); }
    private static String trim(String value) { return value == null ? null : value.trim(); }
}
