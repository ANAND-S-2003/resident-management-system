# Resident Management System

Resident Management System (RMS), a role-based residential community service-request application. The backend v1 API is complete; see the [authoritative API contract](docs/api.md).

## Planned stack

- Backend: Java 17, Spring Boot 3.x, Maven 3.9+, Spring Security/JWT, Spring Data JPA, Flyway, MySQL 8.4 LTS
- Frontend: React, Vite, React Router, TanStack Query, fetch; Node.js 22 and npm
- Tests: JUnit 5/Testcontainers, Vitest/React Testing Library, Cucumber
- Packaging and CI: Docker Desktop, Docker Compose, GitHub Actions

## Backend local run (Windows PowerShell)

1. From the repository root, copy `.env.example` to `.env` and replace its dummy values with local development values.
2. Start MySQL: `docker compose up -d db`.
3. Load variables into the current PowerShell session: `. .\scripts\load-env.ps1`.
4. In that same session, start the backend: `mvn spring-boot:run` from `backend/`.
5. Check `http://localhost:8080/actuator/health`.
6. Stop the application with Ctrl+C, then stop MySQL from the repository root with `docker compose down`.

## Smoke test

Use two PowerShell windows. These steps run the end-to-end smoke test against the local backend; it creates uniquely named sample records and does not delete data.

**Window 1** (repository root):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\load-env.ps1
docker compose up -d db
cd backend
mvn spring-boot:run
```

Wait until the log says the application has started.

**Window 2** (repository root):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\load-env.ps1
.\scripts\smoke-test.ps1
```

Stop the application with Ctrl+C in Window 1, then run `docker compose down` from the repository root. Database data stays in the Docker volume unless you run `docker compose down -v`. Anonymous contact submissions are rate-limited to five per hour per client IP, so repeated smoke runs from the same IP can hit the documented limit until its rolling window expires.

To check the HTTP helper without Docker or a running backend, run this local fake-server self-test from the repository root:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/smoke-test.selftest.ps1
```

If PowerShell 7 is installed, you can also run `pwsh -NoProfile -File scripts/smoke-test.selftest.ps1`.

## Backend verification

From `backend/`, run `mvn clean verify` for the full suite, or `mvn clean verify -Dit.test=UserCatalogIT` to run only `UserCatalogIT`. The clean step removes stale compiled classes before compilation; the build must fail on any Java compile error. Database-backed integration tests require Docker.

## Frontend (Windows PowerShell)

Start the backend using the steps above, then from the repository root run:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the development URL. To verify the frontend, run `npm run typecheck`, `npm run lint`, `npm run test -- --run`, and `npm run build` from `frontend/`. See [frontend architecture and routes](docs/frontend.md).

The resident area includes the dashboard, request creation/list/detail and status history, notifications, and account settings. Staff feature screens remain placeholders. Run unit tests and the real-backend browser suite from `frontend/`:

```powershell
npm run test -- "--run"
npm run e2e:install
npm run e2e
```

The E2E suite requires the database and backend to be running as described above, plus `RMS_SUPERADMIN_EMAIL` and `RMS_SUPERADMIN_PASSWORD` loaded in that PowerShell session.

Playwright creates uniquely named residents. Read-only resident scenarios reuse one API-registered account per worker; UI registration remains covered by the registration flows. To repeat the suite without the documented registration/login limits interrupting local runs, start the backend in a separate repository-root PowerShell window with `.scripts\start-backend-for-e2e.ps1`. It loads `.env`, starts the database and sets `RMS_RATE_LIMIT_REGISTER_MAX` and `RMS_RATE_LIMIT_LOGIN_MAX` to `1000` for that backend process only. This override is for local E2E runs only, never production. Restarting the backend also resets the in-memory counters; no rate-limit defaults are changed.

### Frontend browser tests (Windows PowerShell)

First start MySQL and the backend using the steps in [Backend local run](#backend-local-run-windows-powershell). Keep that window running. In a second PowerShell window from the repository root, load the same environment so the Playwright tests can sign in as the configured super admin:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\load-env.ps1
cd frontend
npm run e2e:install
npm run e2e
```

Run `npm run e2e:install` once to install Chromium. The E2E suite uses the real backend and database, creates uniquely named test residents, and leaves those records in the database.

## Repository layout

- `backend/` - Java backend skeleton and schema migrations
- `frontend/` - React application foundation, authentication, and design system
- `docs/` - requirements, data model, API, and environment guide
- `.github/workflows/` - intentionally empty for now
- `scripts/` - local environment helper scripts
