# REST API contract

Base path: `/api/v1`. JSON uses `application/json`; dates are ISO `YYYY-MM-DD`; timestamps are ISO-8601 UTC. JWT is sent as `Authorization: Bearer <token>`. Access JWTs use HS256 and expire after 60 minutes. Every authenticated request checks the current user's active flag. The only roles are `USER`, `ADMIN`, and `SUPER_ADMIN`; `ADMIN+` means ADMIN or SUPER_ADMIN. No endpoint creates/promotes a SUPER_ADMIN. All list endpoints accept `page` (zero-based, default 0) and `size` (default 20, maximum 100) and return a page envelope unless stated otherwise.

## Common response formats

Lists use `{"content":[],"page":0,"size":20,"totalElements":0,"totalPages":0}`. Errors use `{"timestamp":"2026-01-01T00:00:00Z","status":400,"code":"VALIDATION_ERROR","message":"Request validation failed","path":"/api/v1/...","details":[{"field":"email","message":"must be valid"}]}`. No response includes a password or password hash.

Common errors: `400 VALIDATION_ERROR`; `401 UNAUTHENTICATED` for missing/invalid/expired JWT, invalid credentials, or inactive account; `403 FORBIDDEN`; `404 NOT_FOUND`; `409 CONFLICT` for duplicate email/name or invalid request transition; `429 TOO_MANY_REQUESTS` for rate limits; `500 INTERNAL_ERROR` with sanitized details only.

## Authentication and registration

### `POST /auth/register` — Anonymous
Request: `{ "fullName":"A Resident", "email":"resident@example.com", "password":"Resident123", "flatNumber":"A-101" }`. Password is 8–72 characters with at least one letter and one digit. Email is normalized lowercase. Role is always assigned as `USER`.
Response `201`: `{ "id":1, "fullName":"A Resident", "email":"resident@example.com", "role":"USER", "flatNumber":"A-101", "active":true }`.
Errors: 400 invalid fields/password policy; 409 email already registered.

### `POST /auth/login` — Anonymous
Request: `{ "email":"resident@example.com", "password":"Resident123" }`.
Response `200`: `{ "accessToken":"<jwt>", "tokenType":"Bearer", "expiresAt":"2026-01-01T01:00:00Z", "user":{ "id":1, "fullName":"A Resident", "email":"resident@example.com", "role":"USER", "flatNumber":"A-101" } }`.
Errors: 400 malformed input; 401 invalid credentials or inactive account; 429 after 5 failed attempts per account and source IP in a rolling 15-minute window. No refresh token is issued. Credential failure does not reveal which field was incorrect.

The initial SUPER_ADMIN is provisioned from startup environment variables only if no super admin exists; it is not created through this API.

## User administration

### `GET /users` — ADMIN+
Query: optional `role`, `active`; page parameters. ADMIN results are restricted to USER accounts; SUPER_ADMIN may view all roles. Response `200`: page of `{id,fullName,email,role,flatNumber,active,createdAt}`.
Errors: common 400/401/403.

### `POST /users` — ADMIN+
Request: `{ "fullName":"...", "email":"...", "password":"Resident123", "role":"USER", "flatNumber":"..." }`. ADMIN may create USER only; SUPER_ADMIN may create USER or ADMIN. Requests for role `SUPER_ADMIN` are always forbidden. Password policy is 8–72 characters with at least one letter and one digit.
Response `201`: `{ "id":1, "fullName":"...", "email":"...", "role":"USER", "flatNumber":"...", "active":true }`.
Errors: common 400/401/403/409.

### `GET /users/{userId}` — ADMIN+ within management scope
Response `200`: `{ "id":1, "fullName":"...", "email":"...", "role":"USER", "flatNumber":"...", "active":true, "createdAt":"...", "updatedAt":"..." }`.
Errors: common 401/403/404. ADMIN may access USER accounts only; SUPER_ADMIN may access USER and ADMIN accounts.

### `PUT /users/{userId}` — ADMIN+ within management scope
Request: `{ "fullName":"...", "email":"...", "flatNumber":"..." }`. Role is immutable; no API promotes users or creates a SUPER_ADMIN. Response `200`: public user object.
Errors: common 400/401/403/404/409.

### `PATCH /users/{userId}/activation` — ADMIN+ within management scope
Request: `{ "active":false }`. ADMIN can deactivate USER only; SUPER_ADMIN may deactivate USER or ADMIN. Reactivation uses `active:true`. Cannot deactivate the currently authenticated account. Deactivation prevents login and invalidates existing JWTs on their next authenticated use. Response `200`: public user object.
Errors: common 400/401/403/404.

## Service catalog

### `GET /services` — USER, ADMIN, SUPER_ADMIN
Query: optional `active` (defaults true for USER; ADMIN+ may request all); page parameters. Response `200`: page of `{id,name,description,active}`.
Errors: common 400/401/403.

### `POST /services` — ADMIN+
Request: `{ "name":"Plumbing", "description":"..." }`. Response `201`: `{ "id":1, "name":"Plumbing", "description":"...", "active":true }`.
Errors: common 400/401/403/409 duplicate name.

### `GET /services/{serviceId}` — USER, ADMIN, SUPER_ADMIN
Response `200`: `{ "id":1, "name":"Plumbing", "description":"...", "active":true }`.
Errors: common 401/403/404.

### `PUT /services/{serviceId}` — ADMIN+
Request: `{ "name":"Plumbing", "description":"..." }`. Response `200`: service object.
Errors: common 400/401/403/404/409.

### `PATCH /services/{serviceId}/activation` — ADMIN+
Request: `{ "active":false }`. Response `200`: service object. Services are deactivated rather than hard-deleted, including when referenced.
Errors: common 400/401/403/404.

## Service requests

### `GET /requests` — USER, ADMIN, SUPER_ADMIN
Query: optional `status` (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `REJECTED`), `overdue` boolean; page parameters. USER results contain own requests only; ADMIN+ results include all residents. Response `200`: page of `{id,resident:{id,fullName},flatNumber,service:{id,name},description,requestDate,expectedCompletionDate,status,adminRemarks,overdue,createdAt,updatedAt}`. `overdue` is computed, never stored: expected completion date is before current date AND status is `PENDING` or `IN_PROGRESS`; `COMPLETED` and `REJECTED` are never overdue.
Errors: common 400/401/403.

### `POST /requests` — USER
Request: `{ "serviceId":1, "description":"Leaking tap", "expectedCompletionDate":"2026-11-10" }`. Client sends neither resident/user ID, flat number, request date, nor status. Server derives resident and flat-number snapshot from the authenticated user's profile, sets request date to current date and status to `PENDING`.
Response `201`: request object as above.
Errors: common 400/401/403; 404 service missing or inactive. Expected completion date must be on or after server-assigned request date.

### `GET /requests/{requestId}` — USER, ADMIN, SUPER_ADMIN
USER may access own request only; ADMIN+ may access all. Response `200`: request object as above.
Errors: common 401/403/404. Another resident's request returns 404 to a USER.

### `PATCH /requests/{requestId}` — ADMIN+
Request: `{ "status":"IN_PROGRESS", "adminRemarks":"Technician assigned" }`. At least one field is required. Allowed status transitions: `PENDING` → `IN_PROGRESS` or `REJECTED`; `IN_PROGRESS` → `COMPLETED` or `REJECTED`; `COMPLETED` and `REJECTED` are final. Setting `REJECTED` requires non-empty `adminRemarks`. Invalid transition returns `409 CONFLICT` with a clear message. On an actual status change, create an in-app notification for the resident. Response `200`: updated request object.
Errors: common 400/401/403/404/409.

## Notifications

### `GET /notifications` — USER
Query: optional `unreadOnly`; page parameters. Response `200`: page of `{id,requestId,type,message,read,createdAt,readAt}` for current resident only. `type` is currently `REQUEST_STATUS_CHANGED`.
Errors: common 400/401/403.

### `PATCH /notifications/{notificationId}/read` — USER (owner only)
Request: `{ "read":true }`. Response `200`: `{ "id":1, "read":true, "readAt":"..." }`.
Errors: common 400/401/403/404. Another resident's notification returns 404.

## Dashboard

### `GET /dashboard/summary` — SUPER_ADMIN
Response `200`: `{ "byStatus":{ "PENDING":0, "IN_PROGRESS":0, "COMPLETED":0, "REJECTED":0 }, "overdueCount":0 }`. Counts cover all requests; overdue is computed, never stored, using the same rule stated above.
Errors: common 401/403.

## Contact queries

### `POST /contact-queries` — Anonymous, USER, ADMIN, SUPER_ADMIN
Request: `{ "name":"A Visitor", "email":"visitor@example.com", "subject":"Question", "message":"..." }`. Email is stored lowercase. Authenticated submitter identity is associated when present; supplied contact fields remain explicit.
Response `201`: `{ "id":1, "createdAt":"..." }`.
Errors: 400 validation; 401 if a supplied bearer token is invalid; 429 after 5 anonymous submissions per source IP per hour.

### `GET /contact-queries` — ADMIN+
Query: page parameters. Response `200`: page of `{id,submittedById,name,email,subject,message,createdAt}`.
Errors: common 400/401/403.

### `GET /contact-queries/{queryId}` — ADMIN+
Response `200`: `{ "id":1, "submittedById":null, "name":"A Visitor", "email":"visitor@example.com", "subject":"Question", "message":"...", "createdAt":"..." }`.
Errors: common 401/403/404.

## Contract notes

Paths, pagination envelope, and HTTP methods are specified here as the proposed v1 contract. No physical delete endpoints exist. Token and bootstrap secrets are environment configuration and never returned by the API. Exact field limits are defined in the data model and backend validation.
