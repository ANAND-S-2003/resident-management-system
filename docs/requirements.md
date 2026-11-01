# Requirements

## Purpose and roles

RMS supports residential service requests. Residents submit and track requests; administrators manage the catalog and service operations; super administrators manage administrator accounts and have system-wide visibility.

All accounts are rows in one `users` table, distinguished by role: `USER`, `ADMIN`, or `SUPER_ADMIN`.

- Anyone may register an account as `USER`. Public registration must not accept a role override.
- `ADMIN` users may create, edit, and deactivate `USER` accounts.
- Only `SUPER_ADMIN` users may create, edit, and deactivate `ADMIN` accounts. Super administrators may view system-wide information.
- Login uses email and password. Passwords are stored as BCrypt hashes. Authentication uses JWT; the server enforces authorization for every protected endpoint.
- Deactivation prevents further login and authenticated access; historical records remain.

## Service catalog

Administrators manage service categories such as Plumbing, Electrical, Cleaning, Painting, and Internet Repair. Services can be activated/deactivated; existing requests retain their service association and displayable service name when a service is inactive.

## Service requests

A request has a resident, flat number, service, description, request date, expected completion date, status, and admin remarks. Residents can create and view their own requests. Administrators can view/manage requests across residents. Super administrators can view all requests and dashboard information. Lists are paginated and request filtering by status is supported.

Status is exactly one of `PENDING`, `IN_PROGRESS`, `COMPLETED`, or `REJECTED`. A request is overdue only if its expected completion date is earlier than the current date and its status is `PENDING` or `IN_PROGRESS`. Overdue is calculated at read time and never persisted. `COMPLETED` and `REJECTED` requests are never overdue.

## Notifications

When an administrator changes a request status, the resident receives an in-app notification. Residents can list their notifications and mark a notification as read. A status change by an admin creates one notification for that resident.

## Dashboard

The super-admin dashboard shows counts by each status and the overdue count. Request filtering by status is supported.

## Contact

A logged-in or anonymous visitor can submit a contact query. Administrators can list and view submitted queries. Contact query fields are name, email, subject, and message; authenticated submissions may prefill identity but do not require login.

## Non-functional requirements

- Validate all input server-side.
- Paginate list endpoints.
- Use a consistent JSON error format.
- Never expose plaintext passwords in API responses or elsewhere; use BCrypt hashes at rest.
- Use environment variables for secrets and deployment-specific configuration.

## Assumptions and items to confirm

- Email is unique case-insensitively and is the login identifier.
- Flat number is required but is not globally unique; no building/household table is introduced in this foundation.
- Dates are calendar dates (`DATE`), not timestamps. A request date defaults to the server's current date; clients cannot backdate it. Expected completion date cannot precede request date.
- Admins may update a request's status and remarks; the API draft permits transitions among the four statuses because no transition matrix was specified. A status change notification is created only when the status value actually changes.
- Residents cannot edit or cancel requests after submission in the initial contract; no such action was specified.
- Deactivation is represented by `is_active=false`; deletion is not physical.
- This design does not specify password reset, email verification, refresh-token/logout semantics, notification retention, contact-query response workflow, or audit history. These need decisions before implementation.
