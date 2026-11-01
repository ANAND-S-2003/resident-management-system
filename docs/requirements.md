# Requirements

## Purpose and roles

RMS supports residential service requests. Residents submit and track requests; administrators manage the catalog and service operations; super administrators manage administrator accounts and have system-wide visibility. All accounts are rows in one `users` table with one role: `USER`, `ADMIN`, or `SUPER_ADMIN`.

- Anyone may register an account as `USER`. Public registration cannot set a role.
- `ADMIN` users may create, edit, and deactivate `USER` accounts only.
- Only `SUPER_ADMIN` users may create, edit, and deactivate `ADMIN` accounts. A super admin may also manage USER accounts.
- `SUPER_ADMIN` is created once at startup from environment variables (email, name, password) only when no super admin exists. No API registers or promotes an account to `SUPER_ADMIN`.
- Login uses email and password. Emails are stored lowercase and unique. Passwords are BCrypt hashes; plaintext passwords never appear in API responses. Passwords must be 8–72 characters and contain at least one letter and one digit; the backend validates this.
- JWT uses HS256 access tokens valid for 60 minutes. The signing secret is read from an environment variable, must be at least 32 bytes, and missing/short secrets cause startup failure. There are no refresh tokens in v1.
- Every protected endpoint checks authorization on the server and checks the account's active flag on every request. Deactivated users cannot log in; their existing JWTs stop working.

## Users and services

`flat_number` is required for USER profiles and null for ADMIN and SUPER_ADMIN. Admins manage the service catalog (for example Plumbing, Electrical, Cleaning, Painting, Internet Repair). Services have an active flag. Deactivate rather than delete users or services; records with history are never hard-deleted. Existing requests retain their service reference and displayable service name when a service is deactivated.

## Service requests

A request records the resident, a copy of the resident's flat number at creation, service, description, request date, expected completion date, status, and admin remarks. The request date is assigned by the server at creation and is never accepted from a client. The client does not send a resident/user ID; the server uses the authenticated USER. Expected completion date must be on or after request date.

Status is exactly one of `PENDING`, `IN_PROGRESS`, `COMPLETED`, or `REJECTED`. Backend-enforced transitions are:

- `PENDING` → `IN_PROGRESS` or `REJECTED`
- `IN_PROGRESS` → `COMPLETED` or `REJECTED`
- `COMPLETED` and `REJECTED` are final

An invalid transition returns HTTP 409 with a clear message. Setting status to `REJECTED` requires non-empty admin remarks.

A request is overdue exactly when its expected completion date is before the current date and its status is `PENDING` or `IN_PROGRESS`. Overdue is computed at read time and never stored. `COMPLETED` and `REJECTED` requests are never overdue.

Residents can create and view their own requests. Admins manage requests across residents. Super admins can view all requests and dashboard information. Lists are paginated and requests can be filtered by status.

## Notifications and dashboard

When an admin changes a request's status, the resident receives an in-app notification. Residents can list their notifications and mark them as read. The super-admin dashboard shows counts by each status and the overdue count.

## Contact and rate limits

An anonymous or logged-in visitor can submit a contact query; admins can list and view queries. Planned rate limits (implementation deferred): login is limited to 5 failed attempts per account and source IP in a rolling 15-minute window; anonymous contact submissions are limited to 5 per source IP per hour. Exceeding a limit returns HTTP 429. The exact counting/storage mechanism will be selected during implementation.

## Non-functional requirements

- Validate all input on the backend.
- Paginate list endpoints.
- Use a consistent JSON error format.
- Never expose plaintext passwords or password hashes in API responses.
- Use environment variables for secrets and deployment-specific configuration; fail fast for missing required JWT/bootstrap configuration.

## Future work (out of scope for v1)

- Password reset
- Email verification
- Refresh tokens
- Email/SMS notifications
- WebSocket push

## Other implementation assumptions

- Flat numbers are not globally unique; no building/household table is introduced in v1.
- Request dates and expected completion dates are calendar dates (`DATE`); overdue uses the server's current date.
- Service names are unique. Public login failure does not distinguish an unknown email, bad password, or inactive account.
- Notification retention, contact-query response workflow, and audit history are not specified. No hard-delete operations are provided for records with history.
