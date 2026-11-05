# Frontend architecture

The frontend is a strict TypeScript React application built with Vite. React Router owns navigation, TanStack Query is reserved for server state, React Hook Form and Zod provide form validation, and the API client uses `fetch`. The development server proxies `/api` and `/actuator` to `http://localhost:8080`; production API location is configured by `VITE_API_BASE_URL` and defaults to `/api/v1`.

## Folder structure

```text
frontend/
  src/
    app/                 Providers, router, guards, shell, pages
    components/ui/       Typed accessible design primitives
    config/              Branding and application time zone
    features/auth/       Session provider, login/register, schemas' consumers
    features/dashboard/  Resident and staff dashboards with summary counts
    features/requests/   Request APIs, query hooks, forms, resident/staff lists, details and status presentation
    features/notifications/ Resident notification list and read actions
    features/account/    Profile and change-password page
    lib/api/             Fetch client, session token bridge, DTO types
    lib/dates.ts         Date-only and timestamp formatting helpers
    lib/validation/      Shared backend-aligned Zod schemas
    test/                Vitest setup and MSW handlers
```

Resident dashboard, request creation/list/detail/history, notifications, account screens, staff request management, resident/admin account management, service catalog, contact-message review, and the public contact form are implemented.

## Route map

| Route | Access | Current page |
|---|---|---|
| `/login`, `/register` | Anonymous | Authentication forms |
| `/contact` | Public; authenticated users may also submit | Contact form |
| `/resident` | USER | Dashboard |
| `/resident/requests` | USER | My requests (filters and pagination are stored in the URL query string) |
| `/resident/requests/new` | USER | New service request |
| `/resident/requests/:id` | USER | Request details and status history |
| `/resident/notifications` | USER | Notifications, unread filter and read actions |
| `/admin` | ADMIN or SUPER_ADMIN | Dashboard summary and attention lists |
| `/admin/requests` | ADMIN or SUPER_ADMIN | All requests with URL-backed filters, search, sort, and pagination |
| `/admin/requests/:id` | ADMIN or SUPER_ADMIN | Request details, history, and status/remarks management |
| `/admin/residents` | ADMIN or SUPER_ADMIN | Resident account management |
| `/admin/services` | ADMIN or SUPER_ADMIN | Service catalog management |
| `/admin/messages`, `/admin/messages/:id` | ADMIN or SUPER_ADMIN | Contact-query inbox and detail |
| `/admin/admins` | SUPER_ADMIN | Admin account management |
| `/account` | Any authenticated role | Profile and change password |
| `/forbidden` | Public error page | Access denied |

Unauthenticated protected-route navigation remembers the requested location. On login it is used only when the signed-in role is allowed to access that route; otherwise navigation uses the role home (`USER` -> `/resident`; `ADMIN` and `SUPER_ADMIN` -> `/admin`).

## Authentication and browser session

Access tokens and user details are stored only in namespaced `sessionStorage` (`rms.session.v1`). Reads, writes, and cleanup tolerate blocked or corrupt browser storage. A stored session is checked with `GET /auth/me` before protected views render. Expiry is checked on load and by a timer; an authenticated `401 UNAUTHENTICATED` clears session state and query cache and redirects to login. Invalid credentials are an ordinary login failure, and `403 FORBIDDEN` never clears a session. Logout clears session storage and the TanStack Query cache. Other tabs observe session removal through the browser `storage` event.

If session validation fails for a network or server error other than 401, the app keeps the stored session and offers retry or continue-signed-out actions. This avoids discarding a potentially valid session during a temporary outage; protected content remains unavailable until validation succeeds.

**Trade-off:** `sessionStorage` is available to JavaScript in the page and would be exposed if an XSS bug existed. The app never renders user text as HTML and ESLint rejects `dangerouslySetInnerHTML`; deployments should also use restrictive security headers, including a Content-Security-Policy. Session storage is tab-scoped and is cleared when that tab's session ends; this v1 design does not use cookies or refresh tokens.

## API and error handling

The typed `fetch` wrapper sends JSON only when a body exists, accepts an `AbortSignal`, adds a bearer token from the current session, and parses the documented error envelope. Empty `204 No Content` responses resolve to `undefined` without JSON parsing. `ApiError` carries the HTTP status, API code, safe message, field errors, and `Retry-After` seconds. Network and non-JSON responses map to `NETWORK_ERROR` and `UNKNOWN` without exposing raw response bodies. `INVALID_CREDENTIALS` stays on the login form; `UNAUTHENTICATED` on an authenticated request expires the session; `FORBIDDEN` remains a permission error; rate limits show the documented wait duration. Server-state query functions pass TanStack Query's abort signal through to `fetch`; logout cancels in-flight queries before clearing the cache. Queries do not retry 4xx responses, avoiding duplicate validation, authorization, and not-found requests.

DTO shapes, enum spellings, validation limits and error codes follow the authoritative contract in [api.md](api.md) and [requirements.md](requirements.md). The UI uses text rendering only for user-supplied data.

## Resident request data and query behavior

The shared query-key factory is in `src/lib/query-keys.ts`. Services, request lists (including every filter parameter), request details, request history, notification lists, unread counts, and the current user each have centralized keys. Request creation invalidates request-list and dashboard query data. Notification read mutations update cached list/count data optimistically, restore it on failure, and then invalidate the relevant queries.

The request list keeps status, overdue, page, size, and sort in the URL. Invalid status/sort/page values fall back to safe defaults and page size is clamped to 1-100. Dashboard counts come from the same filtered request-list endpoint and totalElements values as the links on each card; residents do not call the staff dashboard endpoint.

API request dates are date-only `YYYY-MM-DD` values in the community time zone. `src/config/time.ts` defines `APP_TIME_ZONE = "Asia/Kolkata"` and must match backend `RMS_TIMEZONE`. Date-only parsing and display never pass those strings through JavaScript's UTC date-string parser. The minimum date for a new request is computed with `Intl.DateTimeFormat.formatToParts` in that configured time zone. ISO UTC timestamps are parsed as instants and displayed with the browser's locale and time zone.

Unread notification counts refresh every 60 seconds while the document is visible, do not poll in the background, and refresh when the window regains focus. The mark-all action shows a success toast after completion; no extra confirmation dialog is used. Toast announcements live in one persistent polite region. Success messages use `role="status"`, errors use `role="alert"`; they remain for at least six seconds (long success messages remain ten seconds) and their timers pause while hovered or keyboard-focused. Toasts remain manually dismissible.

Shared status badges and request error presentation are in one module/component path. The overdue badge uses only the API's `overdue` field; the browser never recomputes overdue status. `ErrorState` exposes a friendly message and Retry action, while API codes and raw response bodies are kept out of resident-facing text.

## Staff request data and workflow

The staff dashboard calls `GET /dashboard/summary` for the four status totals, overdue count, total requests and active residents. It renders `activeAdmins` only when the current role is `SUPER_ADMIN` and the response contains that property. The pending attention list uses `createdAt,asc`; the most overdue list uses `expectedCompletionDate,asc`, the earliest expected date first. Summary, attention, request list, detail and history queries refresh when the window regains focus.

Staff query keys use the shared factory in `src/lib/query-keys.ts`: `dashboard.summary`, `staffRequests.list(params)`, `staffRequests.detail(id)`, and `staffRequests.history(id)`. A successful status or remarks update invalidates that request's detail and history, every staff and resident request list, and the dashboard summary. Queries pass their abort signal to the API client.

`src/features/requests/request-actions.ts` is the pure UI map for allowed next actions: PENDING offers Start work and Reject; IN_PROGRESS offers Mark completed and Reject; COMPLETED and REJECTED offer none. The backend remains authoritative. REJECTED requires remarks. Completing and rejecting use a confirmation dialog; Start work submits directly with optional remarks. A remarks-only edit is available while open and explains that it creates no history entry and no resident notification.

The staff list stores status, overdue, q, page, size and sort in the URL query string. Unknown status, sort, page and size values fall back or clamp to safe values; q is trimmed and capped at 100 Unicode code points, then applied after an approximately 400 ms debounce. The staff sort whitelist is `createdAt`, `requestDate`, `expectedCompletionDate` and `status`, in either direction, with `createdAt,desc` as the default. Status and overdue filters are sent together when both are selected; q is sent to the backend only in the staff view.

Invalid or non-positive request IDs are treated as not found without an API call. Detail and history data are rendered from the documented request DTO and plain-array history response. A 409 `INVALID_STATUS_TRANSITION` or `CONCURRENT_MODIFICATION` tells staff that another update may have landed, then reloads the request and history. Validation field details map to the remarks control; forbidden, missing, rate-limit and network failures use friendly messages without exposing server text or error codes.

## Account management and contact pages

The user API and service catalog API are typed in `src/features/management/api.ts`; query functions pass TanStack Query abort signals through. Query keys include `users.list(params)`, `users.detail(id)`, `services.list(params)`, `services.detail(id)`, `contactQueries.list(params)`, and `contactQueries.detail(id)`. User mutations invalidate user lists, the affected detail, and the dashboard summary counts. Service mutations invalidate the shared service-list prefix (including the active service list used by request creation) and affected detail. Contact queries are read-only in the staff UI; contact creation does not cache message bodies.

`UserManagementPage` handles both resident accounts (fixed `role=USER`) and admin accounts (fixed `role=ADMIN`, SUPER_ADMIN route only). `src/features/management/user-policy.ts` is the pure UI policy for target-role and self-deactivation controls; API authorization remains authoritative. Admin forms omit `flatNumber`; resident forms require it. Role is never editable. Deactivation requires confirmation and explains that the account is signed out immediately; reactivation is immediate. List `q`, active filter, sort, page and size are stored in the URL; invalid values fall back to defaults, page is nonnegative, and size is clamped to 1-100. Search is trimmed, capped at 100 Unicode code points, and debounced for approximately 400 ms. User sort fields are `createdAt`, `fullName`, `email`, and `role`.

Service management uses URL-backed `q`, active, sort, page and size state. Service sorts are `name` and `createdAt`; name and description limits use Unicode code points. Deactivated services remain visible when the staff filter includes them and are unavailable to residents for new requests. The `ActivationBadge` always says Active or Inactive, so state is not communicated by color alone. Confirmation text explains that deactivation affects only new requests; existing request history remains intact.

Contact messages use the documented paginated envelope, ordered by `createdAt,desc`; the detail route validates positive numeric IDs before requesting data. Sender identity is derived only from `submittedById`. Email links use an encoded mailto address. All message, name, subject and description text is rendered literally. The public contact form sends only name, email, subject and message. It prefills name/email for authenticated users; anonymous requests have no bearer token unless the visitor has an active session. The documented anonymous contact rate limit is five valid submissions per hour per client IP. Repeated local E2E runs use `scripts/start-backend-for-e2e.ps1`, which sets the optional local login, registration and contact limits to 1000 for that backend process only; do not use those overrides in production.

The public contact link is available on sign-in, registration and the authenticated shell. No ComingSoon page or route remains.

## Design tokens and components

The calm blue/slate palette is defined by CSS variables and Tailwind tokens. Light tokens are in `:root`; dark tokens are scoped to `@media (prefers-color-scheme: dark)`. The light palette intentionally uses dark navy text on a light canvas; those colors are not mixed from the dark scheme. Inline links are underlined in both schemes so links in running text remain identifiable without relying on color alone. No theme toggle is present. Components provide visible focus rings, semantic roles and labels, keyboard-operable controls, responsive layouts from 320px, and reduced-motion handling. The `StatusBadge` uses both the status wording and a distinct color, with overdue shown separately.

Contrast ratios below use WCAG relative luminance calculations for foreground/background pairs used by the design tokens and semantic components. Text against its actual background meets 4.5:1, and UI component pairs meet 3:1. Inline links remain underlined in both themes; their adjacent-text contrast is shown separately because underlining distinguishes links even where the adjacent-text ratio is below 3:1.

| Token or component | Foreground | Background | Ratio |
|---|---|---|---:|
| Light primary text | `#0f172a` | `#ffffff` | 17.85:1 |
| Light muted text | `#475569` | `#ffffff` | 7.58:1 |
| Light placeholder text | `#475569` | `#ffffff` | 7.58:1 |
| Light link | `#2563eb` | `#ffffff` | 5.17:1 |
| Light inline link vs adjacent text | `#2563eb` | `#0f172a` | 3.45:1 |
| Light field border | `#64748b` | `#ffffff` | 4.76:1 |
| Light field border on canvas | `#64748b` | `#f8fafc` | 4.55:1 |
| Dark primary text | `#f8fafc` | `#1e293b` | 13.98:1 |
| Dark muted text | `#cbd5e1` | `#1e293b` | 9.85:1 |
| Dark muted text on canvas | `#cbd5e1` | `#0f172a` | 12.02:1 |
| Dark placeholder text | `#cbd5e1` | `#1e293b` | 9.85:1 |
| Dark link | `#528ff0` | `#1e293b` | 4.56:1 |
| Dark link on canvas | `#528ff0` | `#0f172a` | 5.56:1 |
| Dark link hover | `#568ff0` | `#1e293b` | 4.59:1 |
| Dark inline link vs adjacent text | `#528ff0` | `#f8fafc` | 3.07:1 |
| Dark field border | `#94a3b8` | `#1e293b` | 5.71:1 |
| Dark field border on canvas | `#94a3b8` | `#0f172a` | 6.96:1 |
| Light focus ring | `#1d4ed8` | `#ffffff` | 6.70:1 |
| Light focus ring on canvas | `#1d4ed8` | `#f8fafc` | 6.41:1 |
| Dark focus ring | `#93c5fd` | `#1e293b` | 8.11:1 |
| Dark focus ring on canvas | `#93c5fd` | `#0f172a` | 9.90:1 |
| Focused skip-link text | `#1e3a8a` | `#ffffff` | 10.36:1 |
| Light field error | `#b91c1c` | `#ffffff` | 6.47:1 |
| Dark field error | `#fca5a5` | `#1e293b` | 7.71:1 |
| Dark password toggle | `#bfdbfe` | `#1e293b` | 10.30:1 |
| Primary button | `#ffffff` | `#1d4ed8` | 6.70:1 |
| Disabled primary button | `#ffffff` | `#1e40af` | 8.72:1 |
| Danger button | `#ffffff` | `#b91c1c` | 6.47:1 |
| Info badge/alert | `#1e3a8a` | `#dbeafe` | 8.49:1 |
| Success badge/alert | `#14532d` | `#dcfce7` | 8.30:1 |
| Warning badge/alert | `#713f12` | `#fef3c7` | 7.79:1 |
| Error badge/alert | `#7f1d1d` | `#fee2e2` | 8.20:1 |
| Light active navigation | `#1e3a8a` | `#dbeafe` | 8.49:1 |
| Dark active navigation | `#eff6ff` | `#1e3a8a` | 9.52:1 |
| Neutral badge | `#1e293b` | `#e2e8f0` | 11.87:1 |

The field-border ratios exceed the 3:1 non-text component threshold against both surface and canvas. `PENDING` and `IN_PROGRESS` use warning and info badge pairs; `COMPLETED`, `REJECTED`, and `Overdue` use success and danger pairs. The drawer backdrop contains no text; drawer content is on the opaque surface with the listed dark or light text pair. While the modal drawer is open, the underlying shell is inert and hidden from the accessibility tree so obscured page content cannot be focused or announced. Disabled buttons retain full-contrast text; disabled state is conveyed through native disabled behavior and cursor without fading the label. Menu, drawer close, and password-toggle controls have at least 44x44 CSS pixel targets; toast dismissal is at least 24x24, and other controls are at least 40px tall. Focus-visible controls use a 3px outline in the scheme's focus color.

Brand values live in `src/config/branding.ts`. To add a logo, set `logoSrc` to a repository-owned asset path in that configuration; the text wordmark is used when it is `null`. Do not add third-party branding or contact details to the UI. Browser axe checks run as independent tests: Login, Register, resident shell, resident mobile drawer, SUPER_ADMIN shell, and SUPER_ADMIN mobile drawer in both light and dark schemes, plus the resident dashboard, new-request form, request list, request detail, notifications, and account page in both schemes. Each scan has a 90-second test timeout, disables motion, waits for the page and drawer to settle, and attaches the complete axe JSON result. Serious and critical findings include every affected node in the failure summary. Keyboard tests cover the mobile drawer and route guards.

## Run locally (Windows PowerShell)

From the repository root, open a PowerShell window for the backend and database using the [README local run steps](../README.md#backend-local-run-windows-powershell). Then open a frontend window:

```powershell
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite. Development API calls use the Vite proxy. Set `VITE_API_BASE_URL` in an ignored local env file only when the API is hosted at a different base path; never put credentials or server secrets in frontend env variables.

## Tests and quality checks

From `frontend/`:

```powershell
npm run typecheck
npm run lint
npm run test -- --run
npm run build
```

Vitest uses jsdom, React Testing Library, jest-dom, user-event and MSW v2. Keep tests isolated from real services; add API behavior to MSW handlers. jsdom does not implement canvas, so unit axe scans disable only the `color-contrast` rule; the Playwright browser axe scans retain color-contrast in light and dark schemes using a real browser. Use TanStack Query for server data and shared query keys in `src/lib/query-keys.ts`; do not fetch server data from `useEffect`.

## Browser end-to-end tests (Windows PowerShell)

Start MySQL and the backend using the repository's [README local-run steps](../README.md#backend-local-run-windows-powershell), and keep the backend running. In another PowerShell window, load the environment variables (including the super-admin login used by the suite), then install Chromium once and run the real-browser suite:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\load-env.ps1
cd frontend
npm run e2e:install
npm run e2e
```

The Playwright configuration starts Vite on `http://localhost:5173` and reuses an existing server. Tests call the backend on `http://localhost:8080`, create uniquely named test residents, and do not delete records. Failed tests attach browser request/response metadata (method, URL, status), console messages, and page errors; bodies and authorization headers are never recorded, and credential-like text is redacted. Axe checks use one test per page state and color scheme (login, register, resident shell, resident mobile drawer, SUPER_ADMIN shell, SUPER_ADMIN mobile drawer), each with a 90-second timeout. Each scan attaches its full axe JSON result; failures list every serious or critical rule, impact, selector, and node summary. The suite requires `RMS_SUPERADMIN_EMAIL` and `RMS_SUPERADMIN_PASSWORD`; values are never printed.

The read-only shell and axe scenarios reuse one resident registered through the API per Playwright worker. UI registration remains tested by the registration flow and resident lifecycle tests. Registration is normally limited to 10 attempts per rolling hour per client IP, failed logins to 5 per rolling 15 minutes per IP/email, and anonymous contact messages to 5 per hour per IP. For repeated local E2E runs, start the backend in a separate PowerShell window from the repository root with `.\scripts\start-backend-for-e2e.ps1`; it loads `.env`, starts MySQL, and raises only the local backend process's registration, login and contact limits to 1000. These overrides are for local E2E runs only and must never be used in production. Restarting the backend resets its in-memory counters.

Staff browser tests create an ADMIN through the configured SUPER_ADMIN, seed uniquely searchable requests through the API, and exercise both status transitions and concurrency conflict refresh. Management browser tests cover account administration, service activation, contact submissions and message review; all test records use unique values. Anonymous contact submissions per E2E run are kept within the backend limit, and a 429 tells the tester to restart the backend or use the local E2E launcher. Axe scans cover staff and management screens in light and dark schemes. The list pages switch to stacked cards below 700px and are designed to fit 320px viewports.
