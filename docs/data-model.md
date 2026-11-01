# Data model

MySQL 8, InnoDB. Timestamps are UTC. Public API names are mapped in the API doc; all role and status values are exact fixed values enforced by shared enums/constants and database constraints where practical. Nothing with history is hard-deleted; users and services are soft-deactivated with `active`.

## `users`

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, auto increment |
| full_name | VARCHAR(120) | NOT NULL |
| email | VARCHAR(254) | NOT NULL, stored lowercase |
| password_hash | VARCHAR(60) | NOT NULL, BCrypt only |
| role | VARCHAR(20) | NOT NULL, one of `USER`, `ADMIN`, `SUPER_ADMIN` |
| flat_number | VARCHAR(30) | NULL; required for `USER`, null for staff |
| active | BOOLEAN | NOT NULL DEFAULT TRUE |
| created_at | TIMESTAMP(6) | NOT NULL DEFAULT CURRENT_TIMESTAMP(6) |
| updated_at | TIMESTAMP(6) | NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) |

Indexes/constraints: PK(id), UNIQUE(email), INDEX(role,active). Store normalized lowercase emails; uniqueness applies to stored values. Validate role/flat-number relationship in application logic. Bootstrap the first SUPER_ADMIN from environment configuration only when none exists.

## `services`

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, auto increment |
| name | VARCHAR(100) | NOT NULL |
| description | VARCHAR(500) | NULL |
| active | BOOLEAN | NOT NULL DEFAULT TRUE |
| created_by | BIGINT UNSIGNED | NULL, FK users(id), ON DELETE SET NULL |
| created_at | TIMESTAMP(6) | NOT NULL DEFAULT CURRENT_TIMESTAMP(6) |
| updated_at | TIMESTAMP(6) | NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) |

Indexes/constraints: UNIQUE(name), INDEX(active,name). Deactivate rather than delete when referenced.

## `service_requests`

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, auto increment |
| resident_id | BIGINT UNSIGNED | NOT NULL, FK users(id), ON DELETE RESTRICT |
| flat_number | VARCHAR(30) | NOT NULL; resident flat-number snapshot at creation |
| service_id | BIGINT UNSIGNED | NOT NULL, FK services(id), ON DELETE RESTRICT |
| description | TEXT | NOT NULL |
| request_date | DATE | NOT NULL; server-assigned |
| expected_completion_date | DATE | NOT NULL |
| status | VARCHAR(20) | NOT NULL DEFAULT `PENDING`; `PENDING`, `IN_PROGRESS`, `COMPLETED`, or `REJECTED` |
| admin_remarks | TEXT | NULL |
| created_at | TIMESTAMP(6) | NOT NULL DEFAULT CURRENT_TIMESTAMP(6) |
| updated_at | TIMESTAMP(6) | NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6) |

Indexes/constraints: INDEX(resident_id,created_at), INDEX(status,expected_completion_date), INDEX(service_id), CHECK(expected_completion_date >= request_date), CHECK(status IN ('PENDING','IN_PROGRESS','COMPLETED','REJECTED')). Application enforces the transition graph and non-empty remarks when setting `REJECTED`. `overdue` is computed, never stored: expected completion date is before current date AND status is `PENDING` or `IN_PROGRESS`; `COMPLETED` and `REJECTED` are never overdue.

## `notifications`

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, auto increment |
| recipient_id | BIGINT UNSIGNED | NOT NULL, FK users(id), ON DELETE RESTRICT |
| request_id | BIGINT UNSIGNED | NOT NULL, FK service_requests(id), ON DELETE RESTRICT |
| type | VARCHAR(40) | NOT NULL; currently `REQUEST_STATUS_CHANGED` |
| message | VARCHAR(500) | NOT NULL |
| is_read | BOOLEAN | NOT NULL DEFAULT FALSE |
| created_at | TIMESTAMP(6) | NOT NULL DEFAULT CURRENT_TIMESTAMP(6) |
| read_at | TIMESTAMP(6) | NULL |

Indexes/constraints: INDEX(recipient_id,is_read,created_at), INDEX(request_id). Recipient ownership is checked for list/read operations. Notifications are created on a real status change.

## `contact_queries`

| Column | Type | Constraints |
|---|---|---|
| id | BIGINT UNSIGNED | PK, auto increment |
| submitted_by | BIGINT UNSIGNED | NULL, FK users(id), ON DELETE SET NULL |
| name | VARCHAR(120) | NOT NULL |
| email | VARCHAR(254) | NOT NULL, stored lowercase |
| subject | VARCHAR(200) | NOT NULL |
| message | TEXT | NOT NULL |
| created_at | TIMESTAMP(6) | NOT NULL DEFAULT CURRENT_TIMESTAMP(6) |

Indexes/constraints: INDEX(created_at), INDEX(email). Anonymous submissions have `submitted_by=NULL`.

## ER diagram

```mermaid
erDiagram
    USERS ||--o{ SERVICE_REQUESTS : submits
    SERVICES ||--o{ SERVICE_REQUESTS : categorizes
    USERS ||--o{ NOTIFICATIONS : receives
    SERVICE_REQUESTS ||--o{ NOTIFICATIONS : triggers
    USERS o|--o{ SERVICES : creates
    USERS o|--o{ CONTACT_QUERIES : submits
    USERS {
      bigint id PK
      varchar full_name
      varchar email UK
      varchar password_hash
      varchar role
      varchar flat_number
      boolean active
    }
    SERVICES {
      bigint id PK
      varchar name UK
      varchar description
      boolean active
      bigint created_by FK
    }
    SERVICE_REQUESTS {
      bigint id PK
      bigint resident_id FK
      varchar flat_number
      bigint service_id FK
      text description
      date request_date
      date expected_completion_date
      varchar status
      text admin_remarks
    }
    NOTIFICATIONS {
      bigint id PK
      bigint recipient_id FK
      bigint request_id FK
      varchar type
      varchar message
      boolean is_read
      timestamp created_at
      timestamp read_at
    }
    CONTACT_QUERIES {
      bigint id PK
      bigint submitted_by FK
      varchar name
      varchar email
      varchar subject
      text message
      timestamp created_at
    }
```
