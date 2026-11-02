import AxeBuilder from '@axe-core/playwright';
import { expect, redactDiagnosticText, test } from './fixtures';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const backendApi = 'http://localhost:8080/api/v1';
const SESSION_KEY = 'rms.session.v1';
type AxePageState = 'login' | 'register' | 'resident-desktop' | 'resident-mobile' | 'super-admin-desktop' | 'super-admin-mobile';

interface BrowserAuthSession {
  token: string;
  expiresAt: string;
  user: { id: number; fullName: string; email: string; role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; flatNumber: string | null; active: boolean };
}
interface BackendLoginResponse {
  accessToken: string;
  expiresAt: string;
  user: Omit<BrowserAuthSession['user'], 'active'>;
}

let superAdminSessionPromise: Promise<BrowserAuthSession> | null = null;

function addBrowserErrorAssertions(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(redactDiagnosticText(message.text())); });
  page.on('pageerror', (error) => pageErrors.push(redactDiagnosticText(error.message)));
  return async () => {
    expect(consoleErrors, 'Browser console errors').toEqual([]);
    expect(pageErrors, 'Unhandled page errors').toEqual([]);
  };
}

function uniqueResident() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  return {
    fullName: `E2E Resident ${suffix}`,
    email: `e2e-${suffix}@example.test`,
    flatNumber: `F-${suffix.slice(0, 6)}`,
    password: `Resident-${suffix}-7a`,
  };
}

async function createResident(request: APIRequestContext) {
  const credentials = uniqueResident();
  const superAdmin = await getSuperAdminSession(request);
  const created = await request.post(`${backendApi}/users`, {
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    data: { ...credentials, role: 'USER' },
  });
  expect(created.status(), 'Create unique resident test account').toBe(201);
  return credentials;
}

async function getLoginSession(request: APIRequestContext, email: string, password: string): Promise<BrowserAuthSession> {
  const response = await request.post(`${backendApi}/auth/login`, { data: { email, password } });
  expect(response.status(), 'API login for axe scan').toBe(200);
  const login = await response.json() as BackendLoginResponse;
  return { token: login.accessToken, expiresAt: login.expiresAt, user: { ...login.user, active: true } };
}

async function getSuperAdminSession(request: APIRequestContext): Promise<BrowserAuthSession> {
  if (!superAdminSessionPromise) {
    const email = process.env.RMS_SUPERADMIN_EMAIL;
    const password = process.env.RMS_SUPERADMIN_PASSWORD;
    if (!email || !password) throw new Error('Super admin E2E credentials are missing; load them with scripts/load-env.ps1.');
    superAdminSessionPromise = getLoginSession(request, email, password);
  }
  return superAdminSessionPromise;
}

async function installSessionBeforeNavigation(page: Page, session: BrowserAuthSession) {
  await page.addInitScript(({ key, value }) => {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, { key: SESSION_KEY, value: session });
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  const loginResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  const response = await loginResponse;
  return response;
}

async function signInSuperAdmin(page: Page) {
  const email = process.env.RMS_SUPERADMIN_EMAIL;
  const password = process.env.RMS_SUPERADMIN_PASSWORD;
  if (!email || !password) throw new Error('Super admin E2E credentials are missing; load them with scripts/load-env.ps1.');
  const response = await signIn(page, email, password);
  expect(response.status(), 'Super admin login response status').toBe(200);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
}

async function disableMotionForScan(page: Page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addStyleTag({ content: `*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; }` });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
}

async function prepareAxePage(page: Page, request: APIRequestContext, state: AxePageState, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  const mobile = state === 'resident-mobile' || state === 'super-admin-mobile';
  if (mobile) await page.setViewportSize({ width: 375, height: 667 });
  else await page.setViewportSize({ width: 1280, height: 800 });

  if (state === 'login' || state === 'register') {
    await page.goto(state === 'login' ? '/login' : '/register');
  } else {
    let session: BrowserAuthSession;
    if (state.startsWith('resident')) {
      const resident = await createResident(request);
      session = await getLoginSession(request, resident.email, resident.password);
    } else {
      session = await getSuperAdminSession(request);
    }
    await installSessionBeforeNavigation(page, session);
    await page.goto(state.startsWith('resident') ? '/resident' : '/admin');
  }

  const expectedHeading = state === 'login' ? 'Sign in'
    : state === 'register' ? 'Create your resident account'
    : state.startsWith('resident') ? 'Resident dashboard'
    : 'Admin dashboard';
  await expect(page.getByRole('heading', { name: expectedHeading }), `${state} main heading`).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState('networkidle');
  await disableMotionForScan(page);

  if (mobile) {
    await page.getByRole('button', { name: /Open navigation menu/ }).click();
    const drawer = page.getByRole('dialog', { name: 'Mobile navigation' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('button', { name: /Close navigation menu/ })).toBeFocused();
    await page.waitForLoadState('networkidle');
  }
}

async function scanAxeAndAttach(page: Page, state: AxePageState, scheme: 'light' | 'dark', testInfo: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await testInfo.attach(`axe-${state}-${scheme}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: 'application/json',
  });
  const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  const failures = serious.flatMap((violation) => violation.nodes.map((node) =>
    `rule=${violation.id}; impact=${violation.impact}; selector=${node.target.join(', ')}; summary=${(node.failureSummary ?? violation.help).replace(/\s+/g, ' ').trim()}`,
  ));
  expect(failures, failures.length ? `Axe findings for ${state} (${scheme}):\n${failures.map((failure, index) => `${index + 1}. ${failure}`).join('\n')}` : `Axe findings for ${state} (${scheme})`).toEqual([]);
}

test('login renders without browser console or page errors', async ({ page }) => {
  const assertNoBrowserErrors = addBrowserErrorAssertions(page);
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.locator('input[name="email"]')).toBeVisible();
  await expect(page.locator('input[name="password"]')).toBeVisible();
  await assertNoBrowserErrors();
});

test('a resident registers, signs out, and signs back in', async ({ page }) => {
  const resident = uniqueResident();
  await page.goto('/register');
  await page.locator('input[name="fullName"]').fill(resident.fullName);
  await page.locator('input[name="email"]').fill(resident.email);
  await page.locator('input[name="flatNumber"]').fill(resident.flatNumber);
  await page.locator('input[name="password"]').fill(resident.password);
  await page.locator('input[name="confirmPassword"]').fill(resident.password);
  const registrationResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/register'));
  const loginResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Create account' }).click();
  expect((await registrationResponse).status(), 'Resident registration response status').toBe(201);
  expect((await loginResponse).status(), 'Resident login response status').toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Resident dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  const login = await signIn(page, resident.email, resident.password);
  expect(login.status(), 'Resident login response status').toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await expect(page.getByRole('heading', { name: 'Resident dashboard' })).toBeVisible();
});

test('wrong password shows the generic login error', async ({ page }) => {
  const resident = uniqueResident();
  const response = await signIn(page, resident.email, 'WrongPassword123');
  expect(response.status(), 'Wrong-password login response status').toBe(401);
  await expect(page.getByText('Invalid email or password')).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test('SUPER_ADMIN signs in and sees the Admins navigation item', async ({ page }) => {
  await signInSuperAdmin(page);
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Admins' })).toBeVisible();
});

test('a resident visiting /admin sees Forbidden', async ({ page, request }) => {
  const resident = await createResident(request);
  const response = await signIn(page, resident.email, resident.password);
  expect(response.status(), 'Resident login response status').toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
});

test('browser Back after logout does not reveal protected content', async ({ page, request }) => {
  const resident = await createResident(request);
  const response = await signIn(page, resident.email, resident.password);
  expect(response.status(), 'Resident login response status').toBe(200);
  await expect(page.getByRole('heading', { name: 'Resident dashboard' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Resident dashboard' })).toHaveCount(0);
});

test('mobile navigation traps focus, closes with Escape, and fits the viewport', async ({ page, request }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const resident = await createResident(request);
  const response = await signIn(page, resident.email, resident.password);
  expect(response.status(), 'Resident login response status').toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  const openButton = page.getByRole('button', { name: /Open navigation menu/ });
  await openButton.click();
  const drawer = page.getByRole('dialog', { name: 'Mobile navigation' });
  const closeButton = drawer.getByRole('button', { name: /Close navigation menu/ });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.locator('a[href="/account"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(openButton).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test.describe('per-page axe scans', () => {
  test.setTimeout(90_000);
  const pageStates = [
    { state: 'login' as const, title: 'login' },
    { state: 'register' as const, title: 'register' },
    { state: 'resident-desktop' as const, title: 'resident shell (desktop)' },
    { state: 'resident-mobile' as const, title: 'resident mobile drawer open (375x667)' },
    { state: 'super-admin-desktop' as const, title: 'SUPER_ADMIN shell (desktop)' },
    { state: 'super-admin-mobile' as const, title: 'SUPER_ADMIN mobile drawer open (375x667)' },
  ];
  const schemes = ['light', 'dark'] as const;

  for (const { state, title } of pageStates) {
    for (const scheme of schemes) {
      test(`axe: ${title} (${scheme})`, async ({ page, request }, testInfo) => {
        await prepareAxePage(page, request, state, scheme);
        await scanAxeAndAttach(page, state, scheme, testInfo);
      });
    }
  }
});
