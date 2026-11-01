CREATE TABLE users (
    id BIGINT NOT NULL AUTO_INCREMENT,
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL,
    flat_number VARCHAR(30) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_users_email UNIQUE (email),
    INDEX idx_users_role_active (role, active),
    CONSTRAINT chk_users_role CHECK (role IN ('USER', 'ADMIN', 'SUPER_ADMIN')),
    CONSTRAINT chk_users_flat_number CHECK (
        (role = 'USER' AND flat_number IS NOT NULL) OR
        (role <> 'USER' AND flat_number IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE services (
    id BIGINT NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by BIGINT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    CONSTRAINT uq_services_name UNIQUE (name),
    INDEX idx_services_active_name (active, name),
    CONSTRAINT fk_services_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE service_requests (
    id BIGINT NOT NULL AUTO_INCREMENT,
    resident_id BIGINT NOT NULL,
    flat_number VARCHAR(30) NOT NULL,
    service_id BIGINT NOT NULL,
    description VARCHAR(1000) NOT NULL,
    request_date DATE NOT NULL,
    expected_completion_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    admin_remarks VARCHAR(1000) NULL,
    version BIGINT NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    INDEX idx_service_requests_resident_created (resident_id, created_at),
    INDEX idx_service_requests_status_expected (status, expected_completion_date),
    INDEX idx_service_requests_service (service_id),
    CONSTRAINT chk_service_requests_expected_date CHECK (expected_completion_date >= request_date),
    CONSTRAINT chk_service_requests_status CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
    CONSTRAINT fk_service_requests_resident FOREIGN KEY (resident_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_service_requests_service FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE request_status_history (
    id BIGINT NOT NULL AUTO_INCREMENT,
    request_id BIGINT NOT NULL,
    from_status VARCHAR(20) NULL,
    to_status VARCHAR(20) NOT NULL,
    changed_by BIGINT NOT NULL,
    remarks TEXT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    INDEX idx_request_status_history_request_created (request_id, created_at),
    CONSTRAINT chk_request_history_from_status CHECK (from_status IS NULL OR from_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
    CONSTRAINT chk_request_history_to_status CHECK (to_status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'REJECTED')),
    CONSTRAINT fk_request_history_request FOREIGN KEY (request_id) REFERENCES service_requests (id) ON DELETE RESTRICT,
    CONSTRAINT fk_request_history_changed_by FOREIGN KEY (changed_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE notifications (
    id BIGINT NOT NULL AUTO_INCREMENT,
    recipient_id BIGINT NOT NULL,
    request_id BIGINT NOT NULL,
    type VARCHAR(40) NOT NULL,
    message VARCHAR(500) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    read_at DATETIME(6) NULL,
    PRIMARY KEY (id),
    INDEX idx_notifications_recipient_read_created (recipient_id, is_read, created_at),
    INDEX idx_notifications_request (request_id),
    CONSTRAINT fk_notifications_recipient FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT fk_notifications_request FOREIGN KEY (request_id) REFERENCES service_requests (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE contact_queries (
    id BIGINT NOT NULL AUTO_INCREMENT,
    submitted_by BIGINT NULL,
    name VARCHAR(120) NOT NULL,
    email VARCHAR(254) NOT NULL,
    subject VARCHAR(200) NOT NULL,
    message VARCHAR(2000) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    INDEX idx_contact_queries_created (created_at),
    INDEX idx_contact_queries_email (email),
    CONSTRAINT fk_contact_queries_submitter FOREIGN KEY (submitted_by) REFERENCES users (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
