# Contributing

## Before opening a change

Read [AGENTS.md](AGENTS.md) and the relevant contract in `docs/`. Keep changes small and focused, preserve the documented API, and include automated tests for behavior changes. Never commit credentials or real personal data.

## Run checks

From `backend/`, run `mvn clean verify` (requires Docker for Testcontainers integration tests). From `frontend/`, run `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test -- "--run"`, and `npm run build`. Playwright requires the database and backend; see the README for Windows PowerShell steps.

## Commit style

Use short conventional commit messages, for example `feat(frontend): add resident request history` or `fix(backend): validate request dates`. Do not edit a committed Flyway migration; add a new versioned migration instead.
