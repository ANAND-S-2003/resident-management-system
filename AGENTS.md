# Engineering rules

- Keep commits small and focused. Use clear commit messages that describe one coherent change.
- Every feature ships with appropriate automated tests (backend, frontend, and/or BDD coverage as applicable).
- Never commit secrets or credentials. Read configuration from environment variables; document required variables in a `.env.example` file. Never put real credentials in that example.
- Define roles, request statuses, and other shared fixed identifiers/strings once in shared enums or constants. Do not hardcode IDs, roles, or status strings elsewhere.
- Validate all input on the backend, including path/query parameters and request bodies. Client-side validation is supplementary.
- Return consistent JSON error responses across the API. Do not expose stack traces or sensitive data to clients.
- Never store, log, or return plaintext passwords. Persist passwords using BCrypt hashes.
- Enforce authentication and role-based authorization on the server for every protected endpoint; UI checks are not security controls.
- For each task, run the relevant build and tests and report their results honestly, including failures. Do not claim checks ran when they did not.
- Preserve the documented requirements and schema/API contracts. Update relevant docs when a design decision changes.
