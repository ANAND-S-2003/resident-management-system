# Frontend architecture

The frontend is a strict TypeScript React application built with Vite. React Router owns navigation, TanStack Query is reserved for server state, React Hook Form and Zod provide form validation, and the API client uses `fetch`. The development server proxies `/api` and `/actuator` to `http://localhost:8080`; production API location is configured by `VITE_API_BASE_URL` and defaults to `/api/v1`.

## Folder structure

```text
frontend/
  src/
    app/                 Providers, router, guards, shell, pages
    components/ui/       Typed accessible design primitives
    config/              Branding configuration
    features/auth/       Session provider, login/register, schemas' consumers
    lib/api/             Fetch client, session token bridge, DTO types
    lib/validation/      Shared backend-aligned Zod schemas
    test/                Vitest setup and MSW handlers
```

Feature screens for requests, services, residents, notifications, messages, and dashboard are explicitly placeholders until their implementation steps.

## Route map

| Route | Access | Current page |
|---|---|---|
| `/login`, `/register` | Anonymous | Authentication forms |
| `/contact` | Public | Coming soon |
| `/resident`, `/resident/requests`, `/resident/requests/new`, `/resident/requests/:id`, `/resident/notifications` | USER | Coming soon |
| `/admin`, `/admin/requests`, `/admin/requests/:id`, `/admin/residents`, `/admin/services`, `/admin/messages` | ADMIN or SUPER_ADMIN | Coming soon |
| `/admin/admins` | SUPER_ADMIN | Coming soon |
| `/account` | Any authenticated role | Coming soon |
| `/forbidden` | Public error page | Access denied |

Unauthenticated protected-route navigation remembers the requested location. On login it is used only when the signed-in role is allowed to access that route; otherwise navigation uses the role home (`USER` -> `/resident`; `ADMIN` and `SUPER_ADMIN` -> `/admin`).

## Authentication and browser session

Access tokens and user details are stored only in namespaced `sessionStorage` (`rms.session.v1`). Reads, writes, and cleanup tolerate blocked or corrupt browser storage. A stored session is checked with `GET /auth/me` before protected views render. Expiry is checked on load and by a timer; an authenticated `401 UNAUTHENTICATED` clears session state and query cache and redirects to login. Invalid credentials are an ordinary login failure, and `403 FORBIDDEN` never clears a session. Logout clears session storage and the TanStack Query cache. Other tabs observe session removal through the browser `storage` event.

If session validation fails for a network or server error other than 401, the app keeps the stored session and offers retry or continue-signed-out actions. This avoids discarding a potentially valid session during a temporary outage; protected content remains unavailable until validation succeeds.

**Trade-off:** `sessionStorage` is available to JavaScript in the page and would be exposed if an XSS bug existed. The app never renders user text as HTML and ESLint rejects `dangerouslySetInnerHTML`; deployments should also use restrictive security headers, including a Content-Security-Policy. Session storage is tab-scoped and is cleared when that tab's session ends; this v1 design does not use cookies or refresh tokens.

## API and error handling

The typed `fetch` wrapper sends JSON only when a body exists, accepts an `AbortSignal`, adds a bearer token from the current session, and parses the documented error envelope. `ApiError` carries the HTTP status, API code, safe message, field errors, and `Retry-After` seconds. Network and non-JSON responses map to `NETWORK_ERROR` and `UNKNOWN` without exposing raw response bodies. `INVALID_CREDENTIALS` stays on the login form; `UNAUTHENTICATED` on an authenticated request expires the session; `FORBIDDEN` remains a permission error; rate limits show the documented wait duration.

DTO shapes, enum spellings, validation limits and error codes follow the authoritative contract in [api.md](api.md) and [requirements.md](requirements.md). The UI uses text rendering only for user-supplied data.

## Design tokens and components

The calm blue/slate palette is defined by CSS variables and Tailwind tokens. Light and dark palettes follow `prefers-color-scheme`; no theme toggle is present. Components provide visible focus rings, semantic roles and labels, keyboard-operable controls, responsive layouts from 320px, and reduced-motion handling. The `StatusBadge` uses both the status wording and a distinct color, with overdue shown separately. The current axe-core tests cover the authentication form; additional route-level checks should accompany future screen work.

Brand values live in `src/config/branding.ts`. To add a logo, set `logoSrc` to a repository-owned asset path in that configuration; the text wordmark is used when it is `null`. Do not add third-party branding or contact details to the UI. Axe checks cover Login, Register, and the authenticated shell; keyboard tests cover the mobile drawer and route guards.

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

Vitest uses jsdom, React Testing Library, jest-dom, user-event and MSW v2. Keep tests isolated from real services; add API behavior to MSW handlers. Accessibility checks use axe-core. Use TanStack Query for server data and shared query keys in `src/lib/query-keys.ts`; do not fetch server data from `useEffect`.

## Browser end-to-end tests (Windows PowerShell)

Start MySQL and the backend using the repository's [README local-run steps](../README.md#backend-local-run-windows-powershell), and keep the backend running. In another PowerShell window, load the environment variables (including the super-admin login used by the suite), then install Chromium once and run the real-browser suite:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
. .\scripts\load-env.ps1
cd frontend
npm run e2e:install
npm run e2e
```

The Playwright configuration starts Vite on `http://localhost:5173` and reuses an existing server. Tests call the backend on `http://localhost:8080`, create uniquely named test residents, and do not delete records. The suite checks login, registration, role routing, logout history behavior, the mobile drawer, and serious or critical axe violations (including color contrast) in light and dark schemes. It requires `RMS_SUPERADMIN_EMAIL` and `RMS_SUPERADMIN_PASSWORD`; values are never printed.
