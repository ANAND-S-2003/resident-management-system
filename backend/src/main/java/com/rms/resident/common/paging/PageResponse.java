package com.rms.resident.common.paging;

import org.springframework.data.domain.Page;

import java.util.List;

public record PageResponse<T>(List<T> content, int page, int size, long totalElements, int totalPages) {
    public PageResponse {
        content = List.copyOf(content);
    }

    public static <T> PageResponse<T> from(Page<T> source) {
        return new PageResponse<>(source.getContent(), source.getNumber(), source.getSize(),
                source.getTotalElements(), source.getTotalPages());
    }
}
