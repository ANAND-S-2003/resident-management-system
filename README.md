# Resident Management System

Foundation repository for the Resident Management System (RMS), a role-based residential community service-request application.

## Planned stack

- Backend: Java 17, Spring Boot 3.x, Maven 3.9+, Spring Security/JWT, Spring Data JPA, Flyway, MySQL 8
- Frontend: React, Vite, React Router, Axios; Node.js 22 and npm
- Tests: JUnit 5/Testcontainers, Vitest/React Testing Library, Cucumber
- Packaging and CI: Docker, Docker Compose, GitHub Actions

## Repository layout

- `backend/` — backend application (intentionally empty in this foundation step)
- `frontend/` — frontend application (intentionally empty in this foundation step)
- `docs/` — requirements, data model, API, and environment guide
- `.github/workflows/` — CI workflows (intentionally empty in this foundation step)

## Environment prerequisites

Install/use Java 17, Maven 3.9+, Node.js 22, npm, Git, and Docker Desktop with its engine running. Verification commands and expected versions are in [docs/environment.md](docs/environment.md). Review the design documents under `docs/` before implementing features. No application code is included yet.
