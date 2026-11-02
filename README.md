# Resident Management System

Resident Management System (RMS), a role-based residential community service-request application. The backend v1 API is complete; see the [authoritative API contract](docs/api.md).

## Planned stack

- Backend: Java 17, Spring Boot 3.x, Maven 3.9+, Spring Security/JWT, Spring Data JPA, Flyway, MySQL 8.4 LTS
- Frontend: React, Vite, React Router, Axios; Node.js 22 and npm
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

## Repository layout

- `backend/` - Java backend skeleton and schema migrations
- `frontend/` - React application foundation, authentication, and design system
- `docs/` - requirements, data model, API, and environment guide
- `.github/workflows/` - intentionally empty for now
- `scripts/` - local environment helper scripts
