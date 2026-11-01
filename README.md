# Resident Management System

Foundation monorepo for RMS, a role-based residential community service-request application.

## Planned stack

- Backend: Java 17, Spring Boot 3.x, Maven 3.9+, Spring Data JPA, Flyway, MySQL 8.4 LTS; Spring Security/JWT is planned for a later step
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

## Backend verification

From `backend/`, run `mvn clean verify` for the full suite, or `mvn clean verify -Dit.test=UserCatalogIT` to run only `UserCatalogIT`. The clean step removes stale compiled classes before compilation; the build must fail on any Java compile error. Database-backed integration tests require Docker.

## Repository layout

- `backend/` - Java backend skeleton and schema migrations
- `frontend/` - intentionally empty for now
- `docs/` - requirements, data model, API, and environment guide
- `.github/workflows/` - intentionally empty for now
- `scripts/` - local environment helper scripts
