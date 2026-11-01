package com.rms.resident.common.paging;

import com.rms.resident.common.error.ApiException;
import com.rms.resident.common.error.ErrorCode;
import org.springframework.data.domain.Sort;

import java.util.Set;

public final class SortValidator {
    public static final int MAX_PAGE_SIZE = 100;
    public static final int DEFAULT_PAGE_SIZE = 20;

    private SortValidator() {}

    public static SortSpec parse(String requested, String defaultValue, Set<String> allowedFields) {
        String value = requested == null || requested.isBlank() ? defaultValue : requested;
        if (value == null) throw validation("A default sort is required");
        String[] parts = value.split(",", -1);
        if (parts.length != 2) throw validation("Sort must use field,asc or field,desc format");
        String field = parts[0].trim();
        String direction = parts[1].trim().toLowerCase(java.util.Locale.ROOT);
        if (!allowedFields.contains(field)) throw validation("Unsupported sort field");
        Sort.Direction sortDirection;
        try {
            sortDirection = Sort.Direction.fromString(direction);
        } catch (IllegalArgumentException ex) {
            throw validation("Sort direction must be asc or desc");
        }
        return new SortSpec(field, sortDirection);
    }

    public static int clampSize(Integer requested) {
        if (requested == null) return DEFAULT_PAGE_SIZE;
        return Math.max(1, Math.min(requested, MAX_PAGE_SIZE));
    }

    private static ApiException validation(String message) {
        return new ApiException(ErrorCode.VALIDATION_ERROR, message);
    }

    public record SortSpec(String field, Sort.Direction direction) {
        public Sort toSort() {
            return Sort.by(direction, field);
        }
    }
}
