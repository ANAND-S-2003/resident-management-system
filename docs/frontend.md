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

The calm blue/slate palette is defined by CSS variables and Tailwind tokens. Light tokens are in `:root`; dark tokens are scoped to `@media (prefers-color-scheme: dark)`. The light palette intentionally uses dark navy text on a light canvas; those colors are not mixed from the dark scheme. Inline links are underlined in both schemes so links in running text remain identifiable without relying on color alone. No theme toggle is present. Components provide visible focus rings, semantic roles and labels, keyboard-operable controls, responsive layouts from 320px, and reduced-motion handling. The `StatusBadge` uses both the status wording and a distinct color, with overdue shown separately.

Contrast ratios below use WCAG relative luminance calculations for foreground/background pairs used by the design tokens and semantic components. Text against its actual background meets 4.5:1, and UI component pairs meet 3:1. Inline links remain underlined in both themes; their adjacent-text contrast is shown separately because underlining distinguishes links even where the adjacent-text ratio is below 3:1.

| Token or component | Foreground | Background | Ratio |
|---|---|---|---:|
| Light primary text | `#0f172a` | `#ffffff` | 17.85:1 |
| Light muted text | `#475569` | `#ffffff` | 7.58:1 |
| Light link | `#2563eb` | `#ffffff` | 5.17:1 |
| Light inline link vs adjacent text | `#2563eb` | `#0f172a` | 3.45:1 |
| Dark primary text | `#f8fafc` | `#1e293b` | 13.98:1 |
| Dark muted text | `#cbd5e1` | `#1e293b` | 9.85:1 |
| Dark link | `#93c5fd` | `#1e293b` | 8.11:1 |
| Dark inline link vs adjacent text | `#93c5fd` | `#f8fafc` | 1.72:1 (underlined) |
| Light focus ring | `#1d4ed8` | `#ffffff` | 6.70:1 |
| Dark focus ring | `#93c5fd` | `#1e293b` | 8.11:1 |
| Light field error | `#b91c1c` | `#ffffff` | 6.47:1 |
| Dark field error | `#fca5a5` | `#1e293b` | 7.71:1 |
| Primary button | `#ffffff` | `#1d4ed8` | 6.70:1 |
| Danger button | `#ffffff` | `#b91c1c` | 6.47:1 |
| Info badge/alert | `#1e3a8a` | `#dbeafe` | 8.49:1 |
| Success badge/alert | `#14532d` | `#dcfce7` | 8.30:1 |
| Warning badge/alert | `#713f12` | `#fef3c7` | 7.79:1 |
| Error badge/alert | `#7f1d1d` | `#fee2e2` | 8.20:1 |
| Light active navigation | `#1e3a8a` | `#dbeafe` | 8.49:1 |
| Dark active navigation | `#eff6ff` | `#1e3a8a` | 9.52:1 |
| Neutral badge | `#1e293b` | `#e2e8f0` | 11.87:1 |

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

The Playwright configuration starts Vite on `http://localhost:5173` and reuses an existing server. Tests call the backend on `http://localhost:8080`, create uniquely named test residents, and do not delete records. Failed tests attach browser request/response metadata (method, URL path, status), console messages, and page errors; bodies and authorization headers are never recorded, and credential-like text is redacted. The suite checks login, registration, role routing, logout history behavior, the mobile drawer, and serious or critical axe violations (including color contrast) in light and dark schemes. It requires `RMS_SUPERADMIN_EMAIL` and `RMS_SUPERADMIN_PASSWORD`; values are never printed.
