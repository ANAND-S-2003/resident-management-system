package com.rms.resident.user;

import com.rms.resident.common.enums.Role;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(name = "users", uniqueConstraints = @UniqueConstraint(name = "uq_users_email", columnNames = "email"))
public class UserAccount {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "full_name", nullable = false, length = 120)
    private String fullName;
    @Column(nullable = false, length = 254)
    private String email;
    @Column(name = "password_hash", nullable = false, length = 100)
    private String passwordHash;
    @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
    private Role role;
    @Column(name = "flat_number", length = 30)
    private String flatNumber;
    @Column(nullable = false)
    private boolean active;
    @Column(name = "created_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant createdAt;
    @Column(name = "updated_at", nullable = false, columnDefinition = "DATETIME(6)")
    private Instant updatedAt;

    protected UserAccount() {}

    public static UserAccount create(String fullName, String email, String passwordHash, Role role,
                                     String flatNumber, Instant now) {
        UserAccount user = new UserAccount();
        user.fullName = fullName;
        user.email = email;
        user.passwordHash = passwordHash;
        user.role = role;
        user.flatNumber = flatNumber;
        user.active = true;
        user.createdAt = now;
        user.updatedAt = now;
        return user;
    }

    public void changePasswordHash(String passwordHash, Instant now) {
        this.passwordHash = Objects.requireNonNull(passwordHash);
        this.updatedAt = Objects.requireNonNull(now);
    }

    public Long getId() { return id; }
    public String getFullName() { return fullName; }
    public String getEmail() { return email; }
    public String getPasswordHash() { return passwordHash; }
    public Role getRole() { return role; }
    public String getFlatNumber() { return flatNumber; }
    public boolean isActive() { return active; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
