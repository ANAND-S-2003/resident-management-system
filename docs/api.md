# REST API contract (proposed)

Base path: `/api/v1`. JSON request/response bodies use `application/json`; dates use ISO `YYYY-MM-DD`; timestamps are ISO-8601 UTC. JWT is sent as `Authorization: Bearer <token>`. `USER`, `ADMIN`, and `SUPER_ADMIN` are the only roles. `ADMIN+` means ADMIN or SUPER_ADMIN. All list endpoints accept `page` (zero-based, default 0) and `size` (default 20, maximum 100) and return a page envelope unless stated otherwise.

## Common response formats

Success resources are JSON objects. Lists use:

```json
{"content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0}
```

Errors use:

```json
{"timestamp":"2026-01-01T00:00:00Z","status":400,"code":"VALIDATION_ERROR","message":"Request validation failed","path":"/api/v1/...","details":[{"field":"email","message":"must be valid"}]}
```

Common errors: `400 VALIDATION_ERROR` malformed/invalid input; `401 UNAUTHENTICATED` missing/invalid/expired JWT or inactive account; `403 FORBIDDEN` authenticated but disallowed; `404 NOT_FOUND`; `409 CONFLICT` duplicate email/name or state conflict; `500 INTERNAL_ERROR` sanitized unexpected failure. No error response includes credentials, password hashes, or stack traces.

## Authentication and registration

### `POST /auth/register` — Anonymous
Request: `{ "fullName":"A Resident", "email":"resident@example.com", "password":"...", "flatNumber":"A-101" }`
Response `201`: `{ "id":1, "fullName":"A Resident", "email":"resident@example.com", "role":"USER", "flatNumber":"A-101", "active":true }`. Role is assigned by server and cannot be requested.
Errors: 400 invalid fields/password policy; 409 email already registered.

### `POST /auth/login` — Anonymous
Request: `{ "email":"resident@example.com", "password":"..." }`
Response `200`: `{ "accessToken":"<jwt>", "tokenType":"Bearer", "expiresAt":"2026-01-01T01:00:00Z", "user":{ "id":1, "fullName":"A Resident", "email":"resident@example.com", "role":"USER", "flatNumber":"A-101" } }`.
Errors: 400 malformed input; 401 invalid credentials or inactive account. Credential failure does not reveal which field was incorrect.

## User administration

### `GET /users` — ADMIN+ (SUPER_ADMIN sees all; ADMIN sees USER accounts)
Query: optional `role`, `active`; page parameters. Response `200`: page of `{id,fullName,email,role,flatNumber,active,createdAt}`. ADMIN cannot query or see staff accounts.
Errors: common 400/401/403.

### `POST /users` — ADMIN+ (ADMIN may create USER only; SUPER_ADMIN may create ADMIN or USER)
Request: `{ "fullName":"...", "email":"...", "password":"...", "role":"USER", "flatNumber":"..." }`. ADMIN role is forbidden for ADMIN callers. Response `201`: public user object `{id,fullName,email,role,flatNumber,active}`; never includes password or hash.
Errors: common 400/401/403/409.

### `GET /users/{userId}` — ADMIN+ within account-management scope
Response `200`: `{ "id":1, "fullName":"...", "email":"...", "role":"USER", "flatNumber":"...", "active":true, "createdAt":"...", "updatedAt":"..." }`.
Errors: common 401/403/404.

### `PUT /users/{userId}` — ADMIN+ within account-management scope
Request: `{ "fullName":"...", "email":"...", "flatNumber":"..." }`. Role is immutable through this endpoint; role changes require a future explicit policy. Response `200`: updated public user object.
Errors: common 400/401/403/404/409.

### `PATCH /users/{userId}/deactivation` — ADMIN+ within account-management scope
Request: `{ "active":false }`. ADMIN can deactivate USER only; SUPER_ADMIN may deactivate ADMIN or USER. Response `200`: public user object.
Errors: common 400/401/403/404. Cannot deactivate the currently authenticated account using this endpoint.

## Service catalog

### `GET /services` — Any authenticated role
Query: optional `active` (defaults true for USER, all for ADMIN+); page parameters. Response `200`: page of `{id,name,description,active}`.
Errors: common 400/401/403.

### `POST /services` — ADMIN+
Request: `{ "name":"Plumbing", "description":"..." }`. Response `201`: `{ "id":1, "name":"Plumbing", "description":"...", "active":true }`.
Errors: common 400/401/403/409 duplicate name.

### `GET /services/{serviceId}` — Any authenticated role
Response `200`: `{ "id":1, "name":"Plumbing", "description":"...", "active":true }`.
Errors: common 401/403/404.

### `PUT /services/{serviceId}` — ADMIN+
Request: `{ "name":"Plumbing", "description":"..." }`. Response `200`: service object.
Errors: common 400/401/403/404/409.

### `PATCH /services/{serviceId}/activation` — ADMIN+
Request: `{ "active":false }`. Response `200`: service object. Referenced services are deactivated rather than deleted.
Errors: common 400/401/403/404.

## Service requests

### `GET /requests` — Any authenticated role
Query: optional `status` (one exact allowed value), `overdue` boolean; page parameters. USER results are restricted to own requests; ADMIN+ results include all residents. Response `200`: page of request objects `{id,resident:{id,fullName},flatNumber,service:{id,name},description,requestDate,expectedCompletionDate,status,adminRemarks,overdue,createdAt,updatedAt}`.
Errors: common 400/401/403.

### `POST /requests` — USER
Request: `{ "serviceId":1, "description":"Leaking tap", "expectedCompletionDate":"2026-11-10" }`. Resident identity, flat number, request date, and `PENDING` status are taken/set by server. Response `201`: request object as above. Inactive service cannot be selected.
Errors: common 400/401/403/404 service missing or inactive.

### `GET /requests/{requestId}` — Any authenticated role (USER only own request)
Response `200`: request object as above.
Errors: common 401/403/404. For unauthorized ownership, return 404 to avoid disclosing another resident's request.

### `PATCH /requests/{requestId}` — ADMIN+
Request: `{ "status":"IN_PROGRESS", "adminRemarks":"Technician assigned" }`. Status and remarks are optional, but at least one must be provided. On an actual status change, create an in-app notification for the resident. Response `200`: updated request object.
Errors: common 400/401/403/404; 409 for any future transition rules. Current draft allows any transition among defined statuses.

## Notifications

### `GET /notifications` — USER
Query: optional `unreadOnly`; page parameters. Response `200`: page of `{id,requestId,type,message,read,createdAt,readAt}` for the current resident only.
Errors: common 400/401/403.

### `PATCH /notifications/{notificationId}/read` — USER (owner only)
Request: `{ "read":true }`. Response `200`: `{ "id":1, "read":true, "readAt":"..." }`.
Errors: common 400/401/403/404. Other residents' notifications return 404.

## Dashboard

### `GET /dashboard/summary` — SUPER_ADMIN
Response `200`: `{ "byStatus":{ "PENDING":0, "IN_PROGRESS":0, "COMPLETED":0, "REJECTED":0 }, "overdueCount":0 }`.
Errors: common 401/403. Counts cover all requests; overdue uses the defined computed rule.

## Contact queries

### `POST /contact-queries` — Anonymous or any authenticated role
Request: `{ "name":"A Visitor", "email":"visitor@example.com", "subject":"Question", "message":"..." }`. Response `201`: `{ "id":1, "createdAt":"..." }`. Authenticated submitter identity is associated if present; supplied contact fields remain explicit.
Errors: 400 validation; 401 if a supplied bearer token is invalid; 429 rate limit (implementation policy to be selected).

### `GET /contact-queries` — ADMIN+
Query: page parameters. Response `200`: page of `{id,submittedById,name,email,subject,message,createdAt}`.
Errors: common 400/401/403.

### `GET /contact-queries/{queryId}` — ADMIN+
Response `200`: contact-query object as above.
Errors: common 401/403/404.

## Contract notes

Paths, pagination envelope, and HTTP methods are proposed where the requirements did not specify them. No delete endpoints are included; accounts and catalog services are deactivated, and requests/queries remain available as records. Token lifetime/signing configuration, password policy, rate-limit thresholds, and exact field length limits should be finalized during implementation and kept consistent with validation and migrations.
