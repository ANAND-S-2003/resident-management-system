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

## Backend verification

Run `mvn clean verify` from `backend/` for the full suite, or `mvn clean verify "-Dit.test=UserCatalogIT"` to run only `UserCatalogIT`. The clean step removes stale compiled classes before compilation, and compile errors must fail the build. Database-backed integration tests require Docker.

The HTTP smoke test is a Windows PowerShell script and is not run by GitHub Actions. Start the database and backend using the local steps in [README.md](../README.md#run-locally-in-five-steps-windows-powershell), then run `scripts/smoke-test.ps1` from a second PowerShell window after loading `.env` with `scripts/load-env.ps1`. The smoke test creates uniquely named records and does not delete them. Its local fake-server self-test is `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-test.selftest.ps1`.

## Environment variables

Copy `.env.example` to an untracked `.env` for local development. The app fails fast if a required application variable is missing or invalid. `MYSQL_ROOT_PASSWORD` is used by the local Compose database container only.

| Variable | Required/default | Purpose and validation |
|---|---|---|
| `RMS_DB_URL` | Required | MySQL 8.4 LTS JDBC URL; local default uses port 3307 and UTC connection parameters |
| `RMS_DB_USER` | Required | Database username |
| `RMS_DB_PASSWORD` | Required | Database password |
| `MYSQL_ROOT_PASSWORD` | Required for Compose | Local MySQL root password |
| `RMS_JWT_SECRET` | Required | HS256 key, at least 32 UTF-8 bytes |
| `RMS_SUPERADMIN_EMAIL` | Required | Bootstrap email, lowercase-normalized, max 254 chars |
| `RMS_SUPERADMIN_NAME` | Required | Bootstrap name, 2-120 trimmed chars |
| `RMS_SUPERADMIN_PASSWORD` | Required | Password policy: 8 chars minimum, 72 UTF-8 bytes maximum, letter and digit |
| `RMS_TIMEZONE` | Optional; `Asia/Kolkata` | Valid IANA zone for business dates via injectable Clock |
| `RMS_CORS_ALLOWED_ORIGINS` | Required; empty allowed if no browser origins | Comma-separated explicit origins |
| `RMS_TRUST_PROXY` | Optional; `false` | Trust X-Forwarded-For only when true |
| `RMS_TRUSTED_PROXY_HOPS` | Optional; `1` | When proxy trust is enabled, select the address this many entries from the right of X-Forwarded-For; integer 1-5 |
| `RMS_DB_POOL_MAX` | Optional; `5` | Hikari maximum pool size; integer 1-20 (minimum idle is 0) |
| `RMS_RATE_LIMIT_LOGIN_MAX` | Optional; `5` | Failed login attempts per rolling 15 minutes per client IP and lowercase email; integer 1-10000 |
| `RMS_RATE_LIMIT_REGISTER_MAX` | Optional; `10` | Registration attempts per hour per client IP; integer 1-10000 |
| `RMS_RATE_LIMIT_CONTACT_MAX` | Optional; `5` | Anonymous contact submissions per hour per client IP; integer 1-10000 |
| `VITE_API_BASE_URL` | Optional; `/api/v1` | Frontend API base path; set in `frontend/.env.local` only when the API is hosted at a different base path |
| `SPRING_PROFILES_ACTIVE` | Set to `prod` on Render | Enables INFO logging and disables Hibernate SQL/bind logging |
| `PORT` | Supplied by Render; default `8080` | HTTP port; the backend binds on all interfaces |
CORS allows only required methods and headers; no wildcard origins with credentials or authorization headers. JDBC sessions and Hibernate use UTC. Business dates use `RMS_TIMEZONE`. Login, registration, and anonymous contact rate limits use in-memory counters in single-instance v1; multi-instance needs shared storage such as Redis. Every 429 response includes `Retry-After` seconds.

The rate-limit environment variables are optional overrides; their defaults preserve the documented v1 limits. Raising the login, registration, and contact values (for example to `1000`) is intended only for repeated local E2E runs, never production. The application fails fast if any override is not an integer from 1 through 10000. `scripts/start-backend-for-e2e.ps1` sets all three overrides for that local backend process only.

The `demo` profile and sample data are future work for screenshots and must never run in production.

## Managed deployment (Render and external MySQL)

Build the backend image from the repository root with `docker build -t rms-backend:local ./backend`. The image listens on the Render-provided `PORT` (default 8080), runs as a non-root user, and limits its database pool to five connections by default. For a 76-connection managed MySQL plan, keep `RMS_DB_POOL_MAX` small; five is the default and is suitable for a single instance. Hikari uses `minimum-idle=0`, a 30-second connection timeout and a 10-minute maximum connection lifetime, so sleeping instances do not retain idle pool connections. If multiple app instances are introduced, budget the sum of their pool maxima against the database connection limit.

For a TLS-required managed database, set `RMS_DB_URL` to a provider-issued hostname, port and database name with TLS required and UTC session settings. Example shape only (replace every placeholder; do not commit credentials):

```text
jdbc:mysql://HOST:PORT/DBNAME?sslMode=REQUIRED&connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true
```

Set `SPRING_PROFILES_ACTIVE=prod` in Render. The production profile sets application logging to INFO and disables Hibernate SQL and bind-parameter logging. Supply the required `RMS_*` database, JWT and super-admin variables through Render's environment settings; never put credentials in the image or source repository.

The free Render service may sleep after inactivity, and a free managed database may be powered off while idle. The first HTTP request can be delayed by service wake-up. The backend needs the database reachable during startup and Flyway migration; ensure the managed database is awake before interpreting a failed startup health check.

When `RMS_TRUST_PROXY=true`, `RMS_TRUSTED_PROXY_HOPS` selects the X-Forwarded-For address counted from the right (1 selects the rightmost entry, 2 the next entry to its left; if fewer entries exist, selection is clamped to the leftmost available). The default hop count is 1. Confirm Render's actual forwarded-header chain and the correct hop count after the first deploy; do not assume the platform's proxy topology.
