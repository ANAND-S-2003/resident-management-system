# Engineering rules

- Keep commits small and focused. Use clear commit messages for coherent changes.
- Every feature ships with appropriate automated tests (backend, frontend, and/or BDD as applicable).
- Never commit secrets. Read them from environment variables and document required variables in `.env.example` using dummy values only.
- Define roles, request statuses, and other fixed identifiers once in shared enums/constants. Do not hardcode IDs, roles, or status strings elsewhere.
- Validate all input on the backend. Trim strings before validating documented limits. Passwords: at least 8 characters, at most 72 UTF-8 bytes, at least one letter and one digit.
- Return the documented consistent JSON errors and distinct codes. Do not expose stack traces or sensitive data.
- Never store, log, or return plaintext passwords. Persist BCrypt hashes only.
- JWT access tokens use HS256 and expire after 60 minutes. `RMS_JWT_SECRET` must be present and at least 32 bytes; fail fast otherwise. No refresh tokens in v1.
- Enforce server-side role authorization on protected endpoints and check the account active flag on every authenticated request.
- Bootstrap a SUPER_ADMIN from environment variables only when none exists. Never expose an API to create or promote a SUPER_ADMIN.
- Soft-deactivate users and services. Never hard-delete records with history.
- Render descriptions, remarks, and contact messages as plain text, never as HTML.
- Use `RMS_TIMEZONE` and one injectable `Clock` for request dates and overdue checks. Configure JDBC and Hibernate to UTC. Any code needing now/today must use this `Clock`.
- Never edit a Flyway migration after it has been committed; add a new `V<n>` migration instead.
- After each task, run the relevant build and tests and report results honestly, including failures.
- Keep requirements, data model, and authoritative v1 API contract consistent; update docs when decisions change.
