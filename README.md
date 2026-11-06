# Resident Management System

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/ci.yml)

> Replace `OWNER/REPO` in the CI badge URL after publishing this repository.

Resident Management System (RMS) is a role-based web application for residential communities. Residents submit and track service requests; staff manage requests, accounts, services, and contact messages.

![Resident dashboard screenshot placeholder](docs/screenshots/resident-dashboard.png)
![Staff request management screenshot placeholder](docs/screenshots/staff-requests.png)

Add screenshots under `docs/screenshots/`; the image above is a placeholder until then.

## Features by role

- **USER (resident):** register, sign in, submit and track service requests, receive in-app status notifications, manage account details, and contact staff.
- **ADMIN:** manage resident accounts and the service catalog, triage and update requests, review contact messages, and view the staff dashboard.
- **SUPER_ADMIN:** all ADMIN capabilities, plus admin-account management and the active-admin dashboard count.
- **Public visitors:** submit a contact query and register as a resident.

The backend v1 REST API is implemented and described in the [authoritative API contract](docs/api.md). The app contains no third-party company branding.

## Technology

- Backend: Java 17, Spring Boot 3.x, Maven 3.9+, Spring Security, JWT, Spring Data JPA, Flyway, MySQL 8.4 LTS.
- Frontend: React 18, Vite, TypeScript, React Router, TanStack Query, React Hook Form, Zod, Tailwind CSS, and `fetch`.
- Tests: JUnit 5 and Testcontainers; Vitest, React Testing Library, MSW, and Playwright with axe accessibility scans.
- Packaging and CI: Docker Compose and GitHub Actions.

See [environment requirements](docs/environment.md) for tool versions and verification commands.

## Run locally in five steps (Windows PowerShell)

1. Install the required tools from [docs/environment.md](docs/environment.md). Copy `.env.example` to `.env` and replace the dummy local values.
2. Open PowerShell at the repository root and load the local variables:

   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   . .\scripts\load-env.ps1
   ```

3. In that same window, start MySQL and the backend:

   ```powershell
   docker compose up -d db
   cd backend
   mvn spring-boot:run
   ```

   Wait for the startup log, then check `http://localhost:8080/actuator/health`. Stop the backend with Ctrl+C and run `docker compose down` from the repository root when finished. Database files remain in the named Docker volume unless `docker compose down -v` is used.

4. Open a second PowerShell window at the repository root and start the frontend:

   ```powershell
   cd frontend
   npm ci
   npm run dev
   ```

5. Open the Vite URL (normally `http://localhost:5173`). Sign in with the configured super-admin account or register a resident account.

## Testing

RMS has three test layers:

1. **Unit and component tests:** backend JUnit tests and frontend Vitest tests run without a real database. Frontend checks include type checking, linting, formatting, UI tests, and jsdom accessibility checks.
2. **Database integration tests:** Maven `*IT` tests use a real MySQL 8.4 Testcontainers database. They run as part of `mvn clean verify` and require a working Docker installation.
3. **Browser end-to-end tests:** Playwright runs Chromium against the real backend and database. It covers user workflows, mobile layouts, and serious/critical axe scans in light and dark color schemes.

Backend, from `backend/`:

```powershell
mvn clean verify
```

To run only `UserCatalogIT`:

```powershell
mvn clean verify "-Dit.test=UserCatalogIT"
```

Frontend, from `frontend/`:

```powershell
npm ci
npm run typecheck
npm run lint
npm run format:check
npm run test -- "--run"
npm run build
```

### Browser end-to-end tests (Windows PowerShell)

Start the database and backend using step 3 above, and keep that window open. For repeated local E2E runs, use the launcher in the backend window instead; it raises only that local process's in-memory rate limits:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\start-backend-for-e2e.ps1
```

In a second window, load the super-admin credentials and run Playwright:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\load-env.ps1
cd frontend
npm run e2e:install
npm run e2e
```

The tests create uniquely named accounts and records and do not delete them. They need `RMS_SUPERADMIN_EMAIL` and `RMS_SUPERADMIN_PASSWORD` in the environment. Rate-limit overrides from the local E2E launcher are for development only and must never be used in production.

### Smoke test

The Windows PowerShell smoke test is an HTTP-level check against an already running backend. Start the database and backend using step 3 above. In another PowerShell window at the repository root, load `.env` and run the script. It creates uniquely named records and does not delete them. Its fake-server helper can be run without Docker or the backend:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\load-env.ps1
.\scripts\smoke-test.ps1
```

The fake-server self-test command is:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-test.selftest.ps1
```

The PowerShell smoke test is not run in GitHub Actions; CI uses backend tests and Playwright instead.

## Docker image and Render deployment

Build the backend image from the repository root with `docker build -t rms-backend:local ./backend`. For Render, use `backend/Dockerfile`, set `SPRING_PROFILES_ACTIVE=prod`, and configure the required database, JWT and super-admin environment variables in Render. Render supplies `PORT`; local container runs default to 8080. For Aiven or another TLS-required MySQL service, use the JDBC URL format documented in [docs/environment.md](docs/environment.md). Keep `RMS_DB_POOL_MAX` within the database connection budget and confirm `RMS_TRUSTED_PROXY_HOPS` against Render's forwarded-header chain after the first deployment.

To run the image locally against the Compose database from the repository root:

```powershell
docker compose up -d db
docker build -t rms-backend:local ./backend
docker run --rm --name rms-backend -p 8080:8080 --env-file .env -e "RMS_DB_URL=jdbc:mysql://host.docker.internal:3307/rms?connectionTimeZone=UTC&forceConnectionTimeZoneToSession=true" -e "SPRING_PROFILES_ACTIVE=prod" rms-backend:local
```

The `--env-file` supplies local database credentials and the required JWT and bootstrap settings. The URL override makes the container connect to the host-published MySQL port. Stop it with Ctrl+C; stop MySQL with `docker compose down` when finished.

## Design decisions

- All account types share one `users` table with a role column.
- Overdue status is computed from expected date and request status; it is never stored.
- Request status changes follow the documented transition graph and use optimistic locking to detect concurrent updates.
- JWT access tokens expire after 60 minutes. Account deactivation is checked on each authenticated request and blocks the account immediately.
- Login, registration, and anonymous contact rate limits use in-memory counters for the single-instance v1 deployment; multiple instances require shared storage.
- User-supplied descriptions, remarks, and contact messages are rendered as plain text.
- The interface uses RMS branding only; no third-party logo or contact details are included.

## Repository structure

```text
backend/                 Spring Boot API, entities, migrations, and tests
frontend/                React application, unit tests, and Playwright tests
docs/                    Requirements, data model, API, environment, frontend guide
scripts/                 Windows PowerShell environment, smoke-test, and E2E helpers
.github/workflows/       GitHub Actions CI
```

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and [SECURITY.md](SECURITY.md) before making changes or reporting a vulnerability.
