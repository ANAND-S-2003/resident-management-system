package com.rms.resident.catalog;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "services", uniqueConstraints = @UniqueConstraint(name = "uq_services_name", columnNames = "name"))
public class ServiceItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(nullable = false, length = 100)
    private String name;
    @Column(length = 500)
    private String description;
    @Column(nullable = false)
    private boolean active;
    @Column(name = "created_by")
    private Long createdBy;
    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant updatedAt;

    protected ServiceItem() {}

    public static ServiceItem create(String name, String description, Long createdBy, Instant now) {
        ServiceItem item = new ServiceItem();
        item.name = name; item.description = description; item.createdBy = createdBy;
        item.active = true; item.createdAt = now; item.updatedAt = now;
        return item;
    }
    public void update(String name, String description, Instant now) {
        this.name = name; this.description = description; this.updatedAt = Objects.requireNonNull(now);
    }
    public void setActive(boolean active, Instant now) {
        if (this.active != active) {
            this.active = active; this.updatedAt = Objects.requireNonNull(now);
        }
    }
    public Long getId() { return id; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public boolean isActive() { return active; }
    public Long getCreatedBy() { return createdBy; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
