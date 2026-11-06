# REST API contract

This is the authoritative v1 contract. Base path: `/api/v1`. JSON uses `application/json`; dates are ISO `YYYY-MM-DD`; timestamps are UTC ISO-8601. JWT access tokens use HS256, issuer `rms`, subject equal to the user ID, a role claim, issued-at and expiration claims, and expire after 60 minutes; send as `Authorization: Bearer <token>`. Every authenticated request checks the user's active flag and token role against the current database role. A supplied invalid Bearer token is rejected with `401 UNAUTHENTICATED`, even on public endpoints. Tokens cannot be revoked before expiry; there are no refresh tokens or token blacklist in v1. Roles are exactly `USER`, `ADMIN`, and `SUPER_ADMIN`; `ADMIN+` means ADMIN or SUPER_ADMIN. No API creates or promotes SUPER_ADMIN.

All lists use `{"content":[],"page":0,"size":20,"totalElements":0,"totalPages":0}` and accept zero-based `page` (default 0), `size` (default 20, clamped to 1-100), and `sort=<field>,<asc|desc>`. Invalid sort field/direction returns `400 VALIDATION_ERROR`. Strings are trimmed before validation. No response includes a password or password hash. Passwords require at least 8 characters, at most 72 UTF-8 bytes, one letter and one digit. Invalid password message: "Password must be at least 8 characters, no more than 72 UTF-8 bytes, and include at least one letter and one digit."

## Error codes

| HTTP | Code | Meaning |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Invalid input or sort field/direction |
| 400 | `INVALID_CURRENT_PASSWORD` | Current password did not match |
| 401 | `UNAUTHENTICATED` | Missing, invalid, or expired token, or inactive account |
| 401 | `INVALID_CREDENTIALS` | Login failure; same response for unknown email and wrong password |
| 403 | `FORBIDDEN` | Caller lacks permission |
| 404 | `NOT_FOUND` | Missing resource or concealed by ownership rules |
| 405 | `METHOD_NOT_ALLOWED` | HTTP method is not supported for the path |
| 409 | `DUPLICATE_RESOURCE` | Duplicate email or service name |
| 409 | `INVALID_STATUS_TRANSITION` | Transition is not allowed |
| 409 | `CONCURRENT_MODIFICATION` | Optimistic-lock version conflict |
| 429 | `TOO_MANY_REQUESTS` | Rate limit; includes `Retry-After` seconds |
| 500 | `INTERNAL_ERROR` | Sanitized unexpected server error |

Every error body is `{"timestamp":"...","status":400,"code":"VALIDATION_ERROR","message":"...","path":"...","details":[{"field":"...","message":"..."}]}`. Details may be empty. Never include secrets, hashes, or stack traces.

## Authentication

### `POST /auth/register` - Anonymous
Request `{fullName,email,password,flatNumber}`. Role is always USER; email stored lowercase. Limits: fullName 2-120, email max 254, flatNumber 1-30 chars. Password follows the rule above.
Response 201 `{id,fullName,email,role,flatNumber,active}`.
Errors 400 `VALIDATION_ERROR`, 409 `DUPLICATE_RESOURCE`, 429 `TOO_MANY_REQUESTS` (10 requests/hour/IP; `Retry-After`).

### `POST /auth/login` - Anonymous
Request `{email,password}`. For unknown email, compare against a dummy BCrypt hash to keep response times similar.
Response 200 `{accessToken,tokenType,expiresAt,user:{id,fullName,email,role,flatNumber}}`.
Errors 400 `VALIDATION_ERROR`, 401 `INVALID_CREDENTIALS` (uniform for unknown email, wrong password, or inactive account), 429 `TOO_MANY_REQUESTS` (5 failed attempts per rolling 15 minutes keyed by client IP + lowercase email; success resets key; `Retry-After`).

### `GET /auth/me` - USER, ADMIN, SUPER_ADMIN
Response 200 `{id,fullName,email,role,flatNumber,active}`. Error 401 `UNAUTHENTICATED`.

### `POST /auth/change-password` - USER, ADMIN, SUPER_ADMIN
Request `{currentPassword,newPassword}`; new password follows the shared rule and must differ from the current password.
Response 204, no body.
Errors 400 `INVALID_CURRENT_PASSWORD` for wrong current password; 400 `VALIDATION_ERROR` for invalid new password; 401 `UNAUTHENTICATED`.

The first SUPER_ADMIN is provisioned at startup from environment variables only when none exists; no API creates or promotes one.

Registration and login passwords use BCrypt with strength 10. The shared password validation rule applies to registration and new passwords; login accepts the already-stored password without reapplying that policy. Passwords, tokens, and signing secrets are never logged.

## User administration

ADMIN may manage USER accounts only. Accessing, editing, or deactivating a non-USER account as ADMIN returns 403 `FORBIDDEN`. SUPER_ADMIN may manage USER and ADMIN but neither role can create/promote SUPER_ADMIN.

### `GET /users` - ADMIN, SUPER_ADMIN
Query `q` case-insensitive contains on name or email; optional `role`, `active`; pagination. Sort whitelist: `createdAt`, `fullName`, `email`, `role`; default `createdAt,desc`. The `q` value is trimmed and matched literally; percent signs, underscores, and exclamation marks are escaped with `!` and do not act as LIKE wildcards. Blank `q` applies no filter. ADMIN sees USER only; passing `role=ADMIN` or `role=SUPER_ADMIN` returns 403; SUPER_ADMIN may see all roles.
Response 200 page of `{id,fullName,email,role,flatNumber,active,createdAt}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`.

### `POST /users` - ADMIN, SUPER_ADMIN
Request `{fullName,email,password,role,flatNumber}`. ADMIN may create USER only; SUPER_ADMIN may create USER or ADMIN. SUPER_ADMIN role is always forbidden. Apply user and password limits.
Response 201 `{id,fullName,email,role,flatNumber,active}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 409 `DUPLICATE_RESOURCE`.

### `GET /users/{userId}` - ADMIN, SUPER_ADMIN
ADMIN may access USER only; SUPER_ADMIN may access USER and ADMIN.
Response 200 `{id,fullName,email,role,flatNumber,active,createdAt,updatedAt}`.
Errors 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

### `PUT /users/{userId}` - ADMIN, SUPER_ADMIN
Request `{fullName,email,flatNumber}`; role immutable. ADMIN may edit USER only; SUPER_ADMIN may edit USER or ADMIN.
Response 200 `{id,fullName,email,role,flatNumber,active,createdAt,updatedAt}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `DUPLICATE_RESOURCE`.

### `PATCH /users/{userId}/activation` - ADMIN, SUPER_ADMIN
Request `{active:boolean}`. ADMIN may activate/deactivate USER only; SUPER_ADMIN may activate/deactivate USER or ADMIN. Cannot deactivate own account; this returns 400 `VALIDATION_ERROR`. SUPER_ADMIN accounts cannot be deactivated through this API. Activation/deactivation is idempotent. Deactivation blocks login and existing JWTs on next request.
Response 200 `{id,fullName,email,role,flatNumber,active}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

## Services

### `GET /services` - USER, ADMIN, SUPER_ADMIN
Query `q` case-insensitive contains on name; optional `active`; pagination. The `q` value is trimmed and matched literally; percent signs, underscores, and exclamation marks are escaped with `!` and do not act as LIKE wildcards. Blank `q` applies no filter. Sort whitelist: `name`, `createdAt`; default `name,asc`. USER always sees active services; ignore `active` for USER. ADMIN+ may pass true/false or omit for all.
Response 200 page of `{id,name,description,active}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`.

### `POST /services` - ADMIN, SUPER_ADMIN
Request `{name,description}`; name 2-100 chars, description max 500.
Response 201 `{id,name,description,active}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 409 `DUPLICATE_RESOURCE`.

### `GET /services/{serviceId}` - USER, ADMIN, SUPER_ADMIN
USER requesting inactive service gets 404 `NOT_FOUND`; ADMIN+ may view inactive services.
Response 200 `{id,name,description,active}`.
Errors 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

### `PUT /services/{serviceId}` - ADMIN, SUPER_ADMIN
Request `{name,description}`; limits as above.
Response 200 `{id,name,description,active}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `DUPLICATE_RESOURCE`.

### `PATCH /services/{serviceId}/activation` - ADMIN, SUPER_ADMIN
Request `{active:boolean}`. Soft activation/deactivation only.
Response 200 `{id,name,description,active}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

## Service requests

All request responses contain `{id,resident:{id,fullName},flatNumber,service:{id,name},description,requestDate,expectedCompletionDate,status,adminRemarks,version,overdue,createdAt,updatedAt}`. `overdue` is computed, never stored: expected completion date is before current date in `RMS_TIMEZONE` AND status is `PENDING` or `IN_PROGRESS`; `COMPLETED` and `REJECTED` are never overdue. Request date and current date use `RMS_TIMEZONE` through one injectable `Clock`.

### `GET /requests` - USER, ADMIN, SUPER_ADMIN
Query optional status (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`) and overdue boolean; ADMIN+ may pass `q`, case-insensitive contains on resident name or flat number. USER sees own requests only. `overdue=true` selects overdue; `false` selects non-overdue; omitted applies no overdue filter. Status and overdue combine with AND. Sort whitelist: `createdAt`, `requestDate`, `expectedCompletionDate`, `status`; default `createdAt,desc`.
Response 200 page of request objects.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`.

### `POST /requests` - USER
Request `{serviceId,description,expectedCompletionDate}`. Description 5-1000 chars. Client sends no resident ID, flat number, request date, or status. Server derives resident and flat snapshot, sets request date using configured Clock and status `PENDING`. Expected date is on or after request date. Inactive services cannot be selected.
Response 201 request object.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND` for missing/inactive service.

### `GET /requests/{requestId}` - USER, ADMIN, SUPER_ADMIN
USER may access own request only; ADMIN+ may access all. Another resident's request returns 404 to USER.
Response 200 request object.
Errors 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

### `PATCH /requests/{requestId}` - ADMIN, SUPER_ADMIN
Request may include `status` and/or `adminRemarks`; at least one required. Remarks max 1000 chars. Allowed transitions: `PENDING` -> `IN_PROGRESS` or `REJECTED`; `IN_PROGRESS` -> `COMPLETED` or `REJECTED`; `COMPLETED` and `REJECTED` final. Setting REJECTED requires non-empty, non-blank remarks. Every actual status change inserts history and a resident notification in the same transaction as the update.
An `adminRemarks`-only update is allowed while status is `PENDING` or `IN_PROGRESS`; it updates the current remarks without adding history or a notification. For `COMPLETED` or `REJECTED`, remarks-only updates return 409 `INVALID_STATUS_TRANSITION` with a closed-request message. Notification text is plain text and is truncated to 500 characters. Concurrent version conflicts roll back the status, history, and notification together.
Response 200 request object.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`, 409 `INVALID_STATUS_TRANSITION` or `CONCURRENT_MODIFICATION`.

### `GET /requests/{requestId}/history` - USER, ADMIN, SUPER_ADMIN
Same visibility rules as `GET /requests/{requestId}`. Ordered oldest first; accepts `sort=createdAt,asc` only (default), the only allowed sort for history.
Response 200 array of `{fromStatus,toStatus,changedBy:{id,fullName},remarks,createdAt}`; `fromStatus` null for initial entry.
Errors 400 `VALIDATION_ERROR` for any other sort; 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

## Notifications

### `GET /notifications` - USER
Query optional `unreadOnly`; pagination. Sort whitelist: `createdAt`; default `createdAt,desc`. Caller sees own notifications only.
Response 200 page of `{id,requestId,type,message,read,createdAt,readAt}`; type `REQUEST_STATUS_CHANGED`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`.

### `GET /notifications/unread-count` - USER
Response 200 `{count}`. Errors 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`.

### `PATCH /notifications/{notificationId}/read` - USER
Request `{read:true}`; caller may mark own notification only.
Response 200 `{id,read,readAt}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

### `PATCH /notifications/read-all` - USER
Marks all caller's notifications read. Response 204, no body. Errors 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`.

## Dashboard

### `GET /dashboard/summary` - ADMIN, SUPER_ADMIN
ADMIN response `{byStatus:{PENDING,IN_PROGRESS,COMPLETED,REJECTED},overdueCount,totalRequests,activeResidents}`. SUPER_ADMIN gets the same plus `activeAdmins`. `activeResidents` counts active USER accounts. Overdue follows the shared computed rule.
Errors 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`.

## Contact queries

### `POST /contact-queries` - Anonymous, USER, ADMIN, SUPER_ADMIN
Request `{name,email,subject,message}`; name 2-120, email max 254 and stored lowercase, subject 3-200, message 5-2000. Authenticated submitter is associated when available; fields remain explicit.
Response 201 `{id,createdAt}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED` for invalid supplied token, 429 `TOO_MANY_REQUESTS` for anonymous submissions (5/hour/IP; includes `Retry-After`). Only anonymous submissions that pass request validation consume the rate limit; authenticated submissions are not counted.

### `GET /contact-queries` - ADMIN, SUPER_ADMIN
Pagination. Sort whitelist: `createdAt`; default `createdAt,desc`.
Response 200 page of `{id,submittedById,name,email,subject,message,createdAt}`.
Errors 400 `VALIDATION_ERROR`, 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`.

### `GET /contact-queries/{queryId}` - ADMIN, SUPER_ADMIN
Response 200 `{id,submittedById,name,email,subject,message,createdAt}`.
Errors 401 `UNAUTHENTICATED`, 403 `FORBIDDEN`, 404 `NOT_FOUND`.

## Health

### `GET /actuator/health` - Anonymous
Response 200 `{"status":"UP"}` or 503 `{"status":"DOWN"}` only; no details.

## Rate limits, proxy, and CORS

Counters are in-memory; v1 runs one instance. Login: 5 failed attempts per rolling 15 minutes keyed by socket client IP + lowercase email; success resets key. Registration: 10/hour/IP. Anonymous contact: 5/hour/IP. Every 429 has `Retry-After` seconds. Use socket IP unless `RMS_TRUST_PROXY=true`. When trusted, select the X-Forwarded-For entry this many positions from the right, configured by `RMS_TRUSTED_PROXY_HOPS` (default 1, allowed 1-5); if the chain is shorter, clamp to the leftmost available entry. Confirm the correct hop count for the deployment's proxy chain. Multi-instance deployment requires shared counters such as Redis.

CORS allowed origins come from comma-separated `RMS_CORS_ALLOWED_ORIGINS`. Allow only required methods and headers. Never use wildcard origins with credentials or authorization headers.

