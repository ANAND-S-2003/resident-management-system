# Environment requirements

| Tool | Required version/state | Verification command |
|---|---|---|
| Java | 17 | `java -version` |
| Maven | 3.9+ | `mvn -version` |
| Node.js | 22 | `node --version` |
| npm | Bundled with Node.js 22 | `npm --version` |
| Git | Installed | `git --version` |
| Docker Desktop | Installed and running | `docker --version` and `docker info` |
| Docker Compose | Docker Desktop bundled plugin | `docker compose version` |

## Environment variables

Copy `.env.example` to an untracked `.env` for local development. The application fails fast if a required variable is missing or invalid.

| Variable | Required/default | Purpose and validation |
|---|---|---|
| `RMS_DB_URL` | Required | MySQL 8.4 LTS JDBC URL |
| `RMS_DB_USER` | Required | Database username |
| `RMS_DB_PASSWORD` | Required | Database password |
| `RMS_JWT_SECRET` | Required | HS256 key, at least 32 UTF-8 bytes |
| `RMS_SUPERADMIN_EMAIL` | Required | Bootstrap email, lowercase-normalized, max 254 chars |
| `RMS_SUPERADMIN_NAME` | Required | Bootstrap name, 2-120 trimmed chars |
| `RMS_SUPERADMIN_PASSWORD` | Required | Password policy: 8 chars minimum, 72 UTF-8 bytes maximum, letter and digit |
| `RMS_TIMEZONE` | Optional; `Asia/Kolkata` | Valid IANA zone for business dates via injectable Clock |
| `RMS_CORS_ALLOWED_ORIGINS` | Required; empty allowed if no browser origins | Comma-separated explicit origins |
| `RMS_TRUST_PROXY` | Optional; `false` | Trust X-Forwarded-For only when true |

CORS allows only required methods and headers; no wildcard origins with credentials or authorization headers. JDBC and Hibernate use UTC. Business request/overdue dates use `RMS_TIMEZONE`. Login, registration, and anonymous contact rate limits use in-memory counters in the single-instance v1 deployment; multi-instance needs shared storage such as Redis. All 429 responses include `Retry-After` seconds.

The `demo` profile and sample data are future work for screenshots and must never run in production.
