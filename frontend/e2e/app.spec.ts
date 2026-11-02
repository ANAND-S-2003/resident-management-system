import AxeBuilder from '@axe-core/playwright';
import { expect, redactDiagnosticText, test } from './fixtures';
import type { APIRequestContext, Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';

const backendApi = 'http://localhost:8080/api/v1';

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
  const adminLogin = await request.post(`${backendApi}/auth/login`, {
    data: { email: process.env.RMS_SUPERADMIN_EMAIL, password: process.env.RMS_SUPERADMIN_PASSWORD },
  });
  expect(adminLogin.status(), 'Super admin login for isolated resident setup').toBe(200);
  const { accessToken } = await adminLogin.json() as { accessToken: string };
  const created = await request.post(`${backendApi}/users`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: { ...credentials, role: 'USER' },
  });
  expect(created.status(), 'Create unique resident test account').toBe(201);
  return credentials;
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

async function expectSeriousAxeClean(page: Page, scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const serious = results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical');
  expect(serious, `Serious or critical accessibility violations in ${scheme} mode`).toEqual([]);
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
  const openButton = page.getByRole('button', { name: 'Open navigation menu' });
  await openButton.click();
  const drawer = page.getByRole('dialog', { name: 'Mobile navigation' });
  const closeButton = drawer.getByRole('button', { name: 'Close navigation menu' });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(drawer.locator('a[href="/account"]')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
  await expect(openButton).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('login and authenticated shell have no serious or critical axe violations in light and dark mode', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expectSeriousAxeClean(page, 'light');
  await expectSeriousAxeClean(page, 'dark');

  await signInSuperAdmin(page);
  await expect(page.getByRole('heading', { name: 'Admin dashboard' })).toBeVisible();
  await expectSeriousAxeClean(page, 'light');
  await expectSeriousAxeClean(page, 'dark');
});
