package com.rms.resident.catalog;

public record ServiceResponse(Long id, String name, String description, boolean active) {
    public static ServiceResponse from(ServiceItem item) {
        return new ServiceResponse(item.getId(), item.getName(), item.getDescription(), item.isActive());
    }
}
