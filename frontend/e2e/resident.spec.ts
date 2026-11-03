import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';

const api = 'http://localhost:8080/api/v1';
const sessionKey = 'rms.session.v1';
let superAdminTokenPromise: Promise<string> | null = null;

function residentData() {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  return { fullName: `Resident ${suffix}`, email: `resident-${suffix}@example.test`, flatNumber: `F-${suffix.slice(0, 8)}`, password: `Resident-${suffix}-7a` };
}

async function superAdminToken(request: APIRequestContext): Promise<string> {
  if (!superAdminTokenPromise) {
    const email = process.env.RMS_SUPERADMIN_EMAIL;
    const password = process.env.RMS_SUPERADMIN_PASSWORD;
    if (!email || !password) throw new Error('Set RMS_SUPERADMIN_EMAIL and RMS_SUPERADMIN_PASSWORD by loading scripts/load-env.ps1 before running E2E tests.');
    superAdminTokenPromise = request.post(`${api}/auth/login`, { data: { email, password } }).then(async (response) => {
      expect(response.status(), 'Super admin API login status').toBe(200);
      return ((await response.json()) as { accessToken: string }).accessToken;
    });
  }
  return superAdminTokenPromise;
}

async function createResidentScenario(request: APIRequestContext, withRequest: boolean) {
  const credentials = residentData();
  const adminToken = await superAdminToken(request);
  const created = await request.post(`${api}/users`, { headers: { Authorization: `Bearer ${adminToken}` }, data: { ...credentials, role: 'USER' } });
  expect(created.status(), 'Create unique resident account status').toBe(201);
  const login = await request.post(`${api}/auth/login`, { data: { email: credentials.email, password: credentials.password } });
  expect(login.status(), 'Resident API login status').toBe(200);
  const loginBody = await login.json() as { accessToken: string; expiresAt: string; user: { id: number; fullName: string; email: string; role: 'USER'; flatNumber: string } };
  let requestId: number | null = null;
  if (withRequest) {
    const servicePage = await request.get(`${api}/services?active=true&page=0&size=100&sort=name%2Casc`, { headers: { Authorization: `Bearer ${loginBody.accessToken}` } });
    expect(servicePage.status(), 'List active services status').toBe(200);
    const services = (await servicePage.json() as { content: Array<{ id: number }> }).content;
    expect(services.length, 'At least one active service must exist').toBeGreaterThan(0);
    const expected = futureAppDate(7);
    const createdRequest = await request.post(`${api}/requests`, { headers: { Authorization: `Bearer ${loginBody.accessToken}` }, data: { serviceId: services[0]!.id, description: `Unique smoke request ${randomUUID()}`, expectedCompletionDate: expected } });
    expect(createdRequest.status(), 'Create request through API status').toBe(201);
    requestId = (await createdRequest.json() as { id: number }).id;
  }
  return { credentials, session: { token: loginBody.accessToken, expiresAt: loginBody.expiresAt, user: { ...loginBody.user, active: true } }, requestId };
}

function futureAppDate(days: number): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  const date = new Date(Number(parts.year), Number(parts.month) - 1, Number(parts.day) + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function installSession(page: Page, session: unknown) {
  await page.addInitScript(({ key, value }) => { window.sessionStorage.setItem(key, JSON.stringify(value)); }, { key: sessionKey, value: session });
}

async function uiLogin(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/login'));
  await page.getByRole('button', { name: 'Sign in' }).click();
  return responsePromise;
}

async function waitForHeading(page: Page, heading: string) {
  await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState('networkidle');
}

test('resident request lifecycle, notifications, ownership, and password change work end to end', async ({ page, request }) => {
  test.setTimeout(90_000);
  const resident = residentData();
  await page.goto('/register');
  await page.locator('input[name="fullName"]').fill(resident.fullName);
  await page.locator('input[name="email"]').fill(resident.email);
  await page.locator('input[name="flatNumber"]').fill(resident.flatNumber);
  await page.locator('input[name="password"]').fill(resident.password);
  await page.locator('input[name="confirmPassword"]').fill(resident.password);
  const registerResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/register'));
  await page.getByRole('button', { name: 'Create account' }).click();
  expect((await registerResponse).status(), 'Resident register status').toBe(201);
  await waitForHeading(page, 'Welcome, Resident');

  await page.getByRole('link', { name: 'New request' }).click();
  await waitForHeading(page, 'New request');
  const dateInput = page.getByLabel('Expected completion date');
  const minimum = await dateInput.getAttribute('min');
  expect(minimum, 'Date input must have the application-zone minimum').not.toBeNull();
  const [year, month, day] = minimum!.split('-').map(Number);
  const expectedDateObject = new Date(year, month - 1, day + 7);
  const expectedDate = `${expectedDateObject.getFullYear()}-${String(expectedDateObject.getMonth() + 1).padStart(2, '0')}-${String(expectedDateObject.getDate()).padStart(2, '0')}`;
  await page.getByRole('combobox', { name: 'Service' }).selectOption({ index: 1 });
  await page.getByRole('textbox', { name: 'Description' }).fill(`Resident issue ${randomUUID()}`);
  await dateInput.fill(expectedDate);
  const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/requests'));
  await page.getByRole('button', { name: 'Submit request' }).click();
  expect((await createResponse).status(), 'Create request response status').toBe(201);
  await expect(page.getByRole('heading', { name: /Request #\d+: / })).toBeVisible({ timeout: 10_000 });
  const requestPath = new URL(page.url()).pathname;
  const requestId = Number(requestPath.split('/').pop());
  await expect(page.getByText('Created as Pending')).toBeVisible();
  await page.getByRole('link', { name: 'My requests' }).click();
  await waitForHeading(page, 'My requests');
  await expect(page.getByRole('link', { name: `#${requestId}` })).toBeVisible();
  await page.getByRole('link', { name: `#${requestId}` }).click();
  await expect(page.getByRole('heading', { name: new RegExp(`Request #${requestId}:`) })).toBeVisible();

  const admin = await superAdminToken(request);
  const transition = await request.patch(`${api}/requests/${encodeURIComponent(String(requestId))}`, { headers: { Authorization: `Bearer ${admin}` }, data: { status: 'IN_PROGRESS' } });
  expect(transition.status(), 'Admin status transition response').toBe(200);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Notifications, 1 unread' })).toBeVisible({ timeout: 10_000 });
  await page.getByRole('link', { name: 'Notifications, 1 unread' }).click();
  await waitForHeading(page, 'Notifications');
  await expect(page.getByText(/Your request/)).toBeVisible();
  await page.getByRole('button', { name: 'Mark as read' }).click();
  await expect(page.getByRole('link', { name: 'Notifications, 0 unread' })).toBeVisible({ timeout: 10_000 });
  await page.goto(requestPath);
  await expect(page.getByText('From Pending to In progress')).toBeVisible();
  await expect(page.getByText(/Changed by/)).toBeVisible();

  const other = residentData();
  const otherCreated = await request.post(`${api}/auth/register`, { data: other });
  expect(otherCreated.status(), 'Register another unique resident status').toBe(201);
  const otherLoginResponse = await uiLogin(page, other.email, other.password);
  expect(otherLoginResponse.status(), 'Other resident login response status').toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await page.goto(requestPath);
  await expect(page.getByRole('heading', { name: 'Request not found' })).toBeVisible();

  const firstLoginResponse = await uiLogin(page, resident.email, resident.password);
  expect(firstLoginResponse.status(), 'Resident relogin response status').toBe(200);
  await page.goto('/account');
  await waitForHeading(page, 'Account');
  await page.getByLabel('Current password').fill(resident.password);
  const newPassword = `Updated-${randomUUID().slice(0, 8)}-8b`;
  await page.getByLabel('New password').fill(newPassword);
  await page.getByLabel('Confirm new password').fill(newPassword);
  const changeResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/change-password'));
  await page.getByRole('button', { name: 'Change password' }).click();
  expect((await changeResponse).status(), 'Change password response status').toBe(204);
  await expect(page.getByText('Password changed successfully. You are still signed in.')).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  const finalLogin = await uiLogin(page, resident.email, newPassword);
  expect(finalLogin.status(), 'Login with changed password status').toBe(200);
  await expect(page.getByRole('heading', { name: new RegExp(`Welcome, ${resident.fullName.split(' ')[0]}`) })).toBeVisible();
});

type ScanState = 'dashboard' | 'new-request' | 'requests-list' | 'request-detail' | 'notifications' | 'account';

async function createScanState(request: APIRequestContext, state: ScanState) {
  const wantsRequest = state === 'requests-list' || state === 'request-detail' || state === 'notifications';
  const scenario = await createResidentScenario(request, wantsRequest);
  if (state === 'notifications' && scenario.requestId) {
    const admin = await superAdminToken(request);
    const changed = await request.patch(`${api}/requests/${scenario.requestId}`, { headers: { Authorization: `Bearer ${admin}` }, data: { status: 'IN_PROGRESS' } });
    expect(changed.status(), 'Create notification for axe state').toBe(200);
  }
  return scenario;
}

async function scanAxe(page: Page, state: ScanState, scheme: 'light' | 'dark', info: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await info.attach(`axe-resident-${state}-${scheme}.json`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  const failures = results.violations.filter((item) => item.impact === 'critical' || item.impact === 'serious').flatMap((item) => item.nodes.map((node) => `rule=${item.id}; impact=${item.impact}; selector=${node.target.join(', ')}; summary=${(node.failureSummary ?? item.help).replace(/\s+/g, ' ').trim()}`));
  expect(failures, failures.join('\n')).toEqual([]);
}

test.describe('resident feature axe scans', () => {
  test.setTimeout(90_000);
  for (const state of ['dashboard', 'new-request', 'requests-list', 'request-detail', 'notifications', 'account'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`axe: resident ${state} (${scheme})`, async ({ page, request }, info) => {
        await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
        const scenario = await createScanState(request, state);
        await installSession(page, scenario.session);
        const path = state === 'dashboard' ? '/resident' : state === 'new-request' ? '/resident/requests/new' : state === 'requests-list' ? '/resident/requests' : state === 'request-detail' ? `/resident/requests/${scenario.requestId}` : state === 'notifications' ? '/resident/notifications' : '/account';
        await page.goto(path);
        const heading = state === 'dashboard' ? `Welcome, ${scenario.credentials.fullName.split(' ')[0]}` : state === 'new-request' ? 'New request' : state === 'requests-list' ? 'My requests' : state === 'request-detail' ? `Request #${scenario.requestId}:` : state === 'notifications' ? 'Notifications' : 'Account';
        if (state === 'request-detail') await expect(page.getByRole('heading', { name: new RegExp(heading) })).toBeVisible({ timeout: 10_000 });
        else await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 10_000 });
        await page.waitForLoadState('networkidle');
        await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}' });
        await scanAxe(page, state, scheme, info);
      });
    }
  }
});

test('resident request list uses stacked cards without horizontal scrolling on mobile', async ({ page, request }) => {
  const scenario = await createResidentScenario(request, true);
  await installSession(page, scenario.session);
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto('/resident/requests');
  await waitForHeading(page, 'My requests');
  await expect(page.locator('.request-mobile-cards')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

