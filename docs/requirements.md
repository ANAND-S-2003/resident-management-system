# Requirements

## Purpose and roles

RMS supports residential service requests. Residents submit and track requests; admins manage the service catalog and requests; super admins manage admin accounts and see system-wide information. All accounts are in one `users` table with role `USER`, `ADMIN`, or `SUPER_ADMIN`.

- Anyone may register only as `USER`. Public registration cannot set or override a role.
- `ADMIN` may create, edit, and deactivate `USER` accounts only. Accessing, editing, or deactivating a non-USER account as ADMIN returns `403 FORBIDDEN`.
- `SUPER_ADMIN` may create, edit, and deactivate `USER` and `ADMIN` accounts. No API creates or promotes an account to `SUPER_ADMIN`.
- Account activation changes are idempotent. A caller cannot deactivate their own account; the API returns `400 VALIDATION_ERROR`. A `SUPER_ADMIN` account cannot be deactivated through user management.
- Create the initial `SUPER_ADMIN` at startup from environment variables only if one does not already exist.
- Login is by lowercase email and password. Passwords are BCrypt hashes and never returned. Passwords require at least 8 characters, at most 72 UTF-8 bytes, one letter, and one digit; backend validation returns a clear message.
- Unknown email, incorrect password, and inactive account login attempts return the same `401 INVALID_CREDENTIALS` response. Unknown email still performs a BCrypt comparison against a dummy hash.
- Changing a password requires the correct current password, a new password that meets the shared policy, and a new password different from the current password.
- JWT access tokens use HS256, expire after 60 minutes, and use `RMS_JWT_SECRET` (minimum 32 bytes). No refresh tokens in v1. Missing/invalid required configuration fails startup.
- Tokens use the user ID as `sub`, the role as a claim, and issuer `rms`; issued-at and expiration are included. A supplied invalid Bearer token is rejected with `401 UNAUTHENTICATED`, even on public endpoints.
- Every protected request checks role authorization and the user's active flag. Deactivated accounts cannot log in, and their existing JWTs stop working on their next request.

## Users and services

`flat_number` is required for USER profiles and null for ADMIN and SUPER_ADMIN. User and service deactivation is soft; no record with history is hard-deleted. Existing requests keep their service reference and displayable name when a service becomes inactive. A Flyway migration seeds five active services: Plumbing, Electrical, Cleaning, Painting, and Internet Repair. It seeds no users. A separate `demo` profile with sample data will be added later for screenshots and must never run in production.

## Requests and status

A request has resident, flat number snapshot, service, description, request date, expected completion date, status, and admin remarks. Only an authenticated USER can create one; the server derives resident and flat number from that user's profile. The server sets request date at creation; clients never send a user ID, flat number, request date, or status. Expected completion date must be on or after request date.

Statuses are exactly `PENDING`, `IN_PROGRESS`, `COMPLETED`, and `REJECTED`. Allowed transitions are `PENDING` -> `IN_PROGRESS` or `REJECTED`; `IN_PROGRESS` -> `COMPLETED` or `REJECTED`. `COMPLETED` and `REJECTED` are final. Invalid transitions return `409 INVALID_STATUS_TRANSITION` with a clear message. Setting `REJECTED` requires non-empty, non-blank admin remarks.

A request is overdue exactly when expected completion date is before the current date in `RMS_TIMEZONE` and status is `PENDING` or `IN_PROGRESS`. Overdue is computed, never stored. `COMPLETED` and `REJECTED` requests are never overdue. Request date and overdue's current date use the same configured zone and one injectable `Clock`; `RMS_TIMEZONE` defaults to `Asia/Kolkata`.

Every request creation adds history from NULL to `PENDING`, changed by the resident. Every actual status change adds a history row in the same transaction as the request update. Concurrent updates return `409 CONCURRENT_MODIFICATION`.
An admin-remarks-only update is allowed for an open request (`PENDING` or `IN_PROGRESS`) and changes the current remarks without adding history or a notification. Remarks-only updates on final statuses are rejected as a closed-request transition. Status-change notification text is plain text and truncated to 500 characters.

Residents can view only their requests; ADMIN and SUPER_ADMIN can view all. Request lists support status, overdue, and (for ADMIN+) resident-name/flat-number search. `overdue=true` includes only overdue, `overdue=false` only non-overdue, and omitted means no overdue filter. Status and overdue filters combine using AND.

## Notifications and dashboard

When an ADMIN or SUPER_ADMIN changes a request status, the resident receives an in-app notification. Residents can list notifications, get unread count, mark one read, or mark all their notifications read. ADMIN and SUPER_ADMIN can view dashboard summary; SUPER_ADMIN also receives active admin count. Dashboard includes counts by status, overdue count, total requests, and active residents.

## Contact and rate limiting

Anonymous or authenticated visitors may submit contact queries; ADMIN and SUPER_ADMIN can list and view them. Rate limits use in-memory counters in v1, which runs as one instance. Login: 5 failed attempts per rolling 15 minutes per client IP + lowercase email; success resets that key. Registration: 10 requests per hour per IP. Anonymous contact: 5 per hour per IP. Every 429 includes `Retry-After` seconds. Client IP is the socket address, using `X-Forwarded-For` only when `RMS_TRUST_PROXY=true`. Multi-instance deployment requires shared counters such as Redis.

## Security and non-functional requirements

- Validate all input on the backend; trim strings before validating limits. See Field limits below.
- Paginate lists and whitelist sort fields per endpoint; unsupported sort fields return 400.
- Return consistent JSON errors and exact distinct codes listed in `docs/api.md`.
- Never expose plaintext passwords or hashes. Login for unknown email performs BCrypt comparison with a dummy hash and returns the same `INVALID_CREDENTIALS` response as other login failures.
- CORS origins come from `RMS_CORS_ALLOWED_ORIGINS` (comma-separated). Allow only required methods and headers; no wildcard with credentials or authorization headers.
- Render user-supplied descriptions, remarks, and contact messages as plain text, never HTML.
- Set JDBC connection and Hibernate time zones to UTC. Business date calculations use `RMS_TIMEZONE` and the injectable `Clock`.

## Field limits

Trim all strings before validation. Limits count Unicode characters except passwords, whose maximum is 72 UTF-8 bytes.

| Field | Limit |
|---|---|
| full_name | 2-120 characters |
| email | maximum 254 characters |
| flat_number | 1-30 characters |
| service name | 2-100 characters |
| service description | maximum 500 characters |
| request description | 5-1000 characters |
| admin_remarks | maximum 1000 characters; required and non-blank when setting `REJECTED` |
| contact name | 2-120 characters |
| contact subject | 3-200 characters |
| contact message | 5-2000 characters |

## Future work

Out of scope for v1: password reset, email verification, refresh tokens, email/SMS notifications, and WebSocket push. A separate demo profile for screenshot data is also future work and never runs in production.

## Known limitations

- Self-registered residents are not verified against flat ownership.
- Rate-limit counters are in memory and do not coordinate across instances.
- Password reset and email verification are unavailable in v1.
- JWTs cannot be revoked before they expire (no refresh tokens or blacklist in v1); deactivating a user blocks them immediately because the active flag is checked on every request.
