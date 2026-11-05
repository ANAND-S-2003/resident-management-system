import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import {
  addDaysToDateOnly,
  adminCredentials,
  applicationToday,
  backendApi,
  createAdminAccount,
  createReadOnlyStaff,
  createResidentScenario,
  installSession,
  superAdminSession,
} from './support/api';
import { signIn } from './support/auth';
import { headings, staffRequestDetailHeading } from './support/headings';
import { mainContent, mainHeading, navigateTo } from './support/landmarks';
import { monitorExpectedBrowserFailures } from './support/expected-browser-failures';

interface CreatedRequest { id: number; service: { name: string } }
interface RequestSummary { byStatus: { PENDING: number; IN_PROGRESS: number; COMPLETED: number; REJECTED: number } }

async function createRequest(request: APIRequestContext, resident: Awaited<ReturnType<typeof createResidentScenario>>): Promise<CreatedRequest> {
  const servicesResponse = await request.get(`${backendApi}/services?page=0&size=100&sort=name%2Casc`, { headers: { Authorization: `Bearer ${resident.session.token}` } });
  expect(servicesResponse.status(), 'Resident active services response').toBe(200);
  const services = await servicesResponse.json() as { content: Array<{ id: number }> };
  const service = services.content[0];
  expect(service, 'At least one active service is seeded').toBeTruthy();
  const response = await request.post(`${backendApi}/requests`, {
    headers: { Authorization: `Bearer ${resident.session.token}` },
    data: { serviceId: service!.id, description: `Staff workflow ${randomUUID()}`, expectedCompletionDate: addDaysToDateOnly(applicationToday(), 7) },
  });
  expect(response.status(), 'Create request for staff workflow').toBe(201);
  return await response.json() as CreatedRequest;
}

async function staffSummary(request: APIRequestContext, token: string): Promise<RequestSummary> {
  const response = await request.get(`${backendApi}/dashboard/summary`, { headers: { Authorization: `Bearer ${token}` } });
  expect(response.status(), 'Read dashboard summary before test data creation').toBe(200);
  return await response.json() as RequestSummary;
}

async function signedInAdmin(page: Page, email: string, password: string) {
  const response = await signIn(page, email, password);
  expect(response.status(), 'ADMIN login status').toBe(200);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
  await expect(mainHeading(page, headings.staffDashboard)).toBeVisible();
}

test('staff dashboard, request search, transitions, rejection, and resident notification work end to end', async ({ page, request, browser }) => {
  test.setTimeout(90_000);
  const browserFailures = monitorExpectedBrowserFailures(page);
  const expectedFailures: Array<{ method: string; path: string; status: number; reason: string }> = [];
  const superSession = await superAdminSession(request);
  const resident = await createResidentScenario(request, false);
  const summaryBefore = await staffSummary(request, superSession.token);
  const firstRequest = await createRequest(request, resident);
  const admin = await createAdminAccount(request, adminCredentials());

  await signedInAdmin(page, admin.email, admin.password);
  const pendingCard = mainContent(page).locator(`a[href="/admin/requests?status=PENDING"] strong`);
  await expect(pendingCard, 'Pending count includes this newly created request').toHaveText(String(summaryBefore.byStatus.PENDING + 1), { timeout: 10_000 });
  const initialListResponse = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('/requests'));
  await navigateTo(page, 'Requests');
  expect((await initialListResponse).status(), 'Staff request list response').toBe(200);
  await expect(mainHeading(page, headings.staffRequests)).toBeVisible();
  const q = mainContent(page).getByRole('textbox', { name: 'Search residents' });
  const searchResponse = page.waitForResponse((response) => {
    if (response.request().method() !== 'GET') return false;
    const url = new URL(response.url());
    return url.pathname.endsWith('/requests') && url.searchParams.get('q') === resident.resident.fullName;
  });
  await q.fill(resident.resident.fullName);
  expect((await searchResponse).status(), 'Search request list response').toBe(200);
  const requestLink = mainContent(page).locator('.request-table').getByRole('link', { name: `#${firstRequest.id}`, exact: true });
  await expect(requestLink).toBeVisible();
  const firstDetailResponse = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith(`/requests/${firstRequest.id}`));
  await requestLink.click();
  expect((await firstDetailResponse).status(), 'Request detail response').toBe(200);
  await expect(mainHeading(page, staffRequestDetailHeading(firstRequest.id, firstRequest.service.name))).toBeVisible();

  const startResponse = page.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/requests/${firstRequest.id}`));
  await mainContent(page).getByRole('button', { name: 'Start work', exact: true }).click();
  expect((await startResponse).status(), 'Start work response').toBe(200);
  await expect(mainContent(page).getByRole('group', { name: 'In progress', exact: true })).toBeVisible();
  await expect(mainContent(page).getByText(`From Pending to In progress`, { exact: true })).toBeVisible();
  await expect(mainContent(page).getByText(`Changed by ${admin.fullName}`, { exact: true })).toBeVisible();

  await mainContent(page).getByRole('button', { name: 'Mark completed', exact: true }).click();
  const completionDialog = page.getByRole('dialog');
  await expect(completionDialog).toContainText(`request #${firstRequest.id} will be marked completed`);
  const completeResponse = page.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/requests/${firstRequest.id}`));
  await completionDialog.getByRole('button', { name: 'Confirm mark completed', exact: true }).click();
  expect((await completeResponse).status(), 'Complete request response').toBe(200);
  await expect(mainContent(page).getByText('This request is closed.', { exact: true })).toBeVisible();
  await expect(mainContent(page).getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);

  const secondRequest = await createRequest(request, resident);
  const secondDetail = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith(`/requests/${secondRequest.id}`));
  await page.goto(`/admin/requests/${encodeURIComponent(String(secondRequest.id))}`);
  expect((await secondDetail).status(), 'Second request detail response').toBe(200);
  await expect(mainHeading(page, staffRequestDetailHeading(secondRequest.id, secondRequest.service.name))).toBeVisible();
  await mainContent(page).getByRole('button', { name: 'Reject', exact: true }).click();
  const rejectDialog = page.getByRole('dialog');
  await rejectDialog.getByRole('button', { name: 'Confirm reject', exact: true }).click();
  await expect(rejectDialog.getByText('Admin remarks are required when rejecting a request.', { exact: true })).toBeVisible();

  const rejectionValidation = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.status() === 400 && new URL(response.url()).pathname.endsWith(`/requests/${secondRequest.id}`));
  const invalidStatus = await page.evaluate(async (requestId) => {
    const stored = window.sessionStorage.getItem('rms.session.v1');
    if (!stored) throw new Error('The authenticated browser session was not available for the API validation check.');
    const session = JSON.parse(stored) as { token: string };
    const response = await fetch(`/api/v1/requests/${encodeURIComponent(String(requestId))}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${session.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'REJECTED' }),
    });
    return response.status;
  }, secondRequest.id);
  expect(invalidStatus, 'Backend requires remarks for REJECTED').toBe(400);
  expect((await rejectionValidation).status(), 'Reject without remarks API response').toBe(400);
  expectedFailures.push({ method: 'PATCH', path: `/api/v1/requests/${secondRequest.id}`, status: 400, reason: 'REJECTED requires remarks' });

  await rejectDialog.getByRole('textbox', { name: 'Admin remarks', exact: true }).fill('Resident requested cancellation');
  const rejectResponse = page.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/requests/${secondRequest.id}`));
  await rejectDialog.getByRole('button', { name: 'Confirm reject', exact: true }).click();
  expect((await rejectResponse).status(), 'Reject request response').toBe(200);
  await expect(mainContent(page).getByText('This request is closed.', { exact: true })).toBeVisible();

  const notificationsResponse = await request.get(`${backendApi}/notifications?page=0&size=100&sort=createdAt%2Cdesc`, { headers: { Authorization: `Bearer ${resident.session.token}` } });
  expect(notificationsResponse.status(), 'Resident notifications response after rejection').toBe(200);
  const notifications = await notificationsResponse.json() as { content: Array<{ requestId: number }> };
  expect(notifications.content.some((notification) => notification.requestId === secondRequest.id), 'Rejected request creates a resident notification').toBe(true);

  const residentPage = await browser.newPage();
  await installSession(residentPage, resident.session);
  await residentPage.goto('/admin/requests');
  await expect(mainHeading(residentPage, headings.forbidden)).toBeVisible();
  await residentPage.close();
  browserFailures.assertExpectedFailures(expectedFailures);
});

test('a second admin receives a conflict and refreshed request after the first admin starts work', async ({ browser, request }) => {
  test.setTimeout(90_000);
  const resident = await createResidentScenario(request, false);
  const target = await createRequest(request, resident);
  const adminA = await createAdminAccount(request, adminCredentials());
  const adminB = await createAdminAccount(request, adminCredentials());
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await contextA.newPage();
  const pageB = await contextB.newPage();
  const failuresB = monitorExpectedBrowserFailures(pageB);
  try {
    await signedInAdmin(pageA, adminA.email, adminA.password);
    await signedInAdmin(pageB, adminB.email, adminB.password);
    await Promise.all([pageA, pageB].map(async (page) => {
      const detail = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith(`/requests/${target.id}`));
      await page.goto(`/admin/requests/${encodeURIComponent(String(target.id))}`);
      expect((await detail).status(), 'Both admins load the same pending request').toBe(200);
      await expect(mainContent(page).getByRole('button', { name: 'Start work', exact: true })).toBeVisible();
    }));
    const firstUpdate = pageA.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/requests/${target.id}`));
    await mainContent(pageA).getByRole('button', { name: 'Start work', exact: true }).click();
    expect((await firstUpdate).status(), 'First admin update succeeds').toBe(200);
    const conflictResponse = pageB.waitForResponse((response) => response.request().method() === 'PATCH' && new URL(response.url()).pathname.endsWith(`/requests/${target.id}`));
    await mainContent(pageB).getByRole('button', { name: 'Start work', exact: true }).click();
    expect((await conflictResponse).status(), 'Second stale update conflicts').toBe(409);
    await expect(mainContent(pageB).getByText('This request was just updated by someone else. We loaded the latest version.', { exact: true })).toBeVisible();
    await expect(mainContent(pageB).getByRole('group', { name: 'In progress', exact: true })).toBeVisible();
    failuresB.assertExpectedFailures([{ method: 'PATCH', path: `/api/v1/requests/${target.id}`, status: 409, reason: 'another admin changed the request' }]);
  } finally {
    await contextA.close();
    await contextB.close();
  }
});

test('staff request list uses stacked cards at a phone viewport without horizontal scrolling', async ({ page, request }) => {
  const admin = await createAdminAccount(request, adminCredentials());
  const resident = await createResidentScenario(request, true);
  await page.setViewportSize({ width: 375, height: 667 });
  await signedInAdmin(page, admin.email, admin.password);
  const listResponse = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname.endsWith('/requests'));
  await navigateTo(page, 'Requests');
  expect((await listResponse).status(), 'Mobile staff request list response').toBe(200);
  await expect(mainHeading(page, headings.staffRequests)).toBeVisible();
  await expect(mainContent(page).locator('.staff-request-mobile-cards')).toBeVisible();
  await expect(mainContent(page).locator('.staff-request-table')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Staff list fits the 375px viewport').toBe(true);
  expect(resident.requestId, 'Resident scenario includes its unique request').not.toBeNull();
});

async function readOnlyAdmin(request: APIRequestContext) {
  return createReadOnlyStaff(request);
}

async function prepareStaffAxePage(page: Page, request: APIRequestContext, state: 'dashboard' | 'list' | 'detail' | 'dialog', scheme: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 1280, height: 800 });
  const staff = await readOnlyAdmin(request);
  const resident = await createResidentScenario(request, true);
  await installSession(page, staff.session);
  const path = state === 'dashboard' ? '/admin' : state === 'list' ? `/admin/requests?q=${encodeURIComponent(resident.resident.fullName)}` : `/admin/requests/${encodeURIComponent(String(resident.requestId))}`;
  await page.goto(path);
  const heading = state === 'dashboard' ? headings.staffDashboard : state === 'list' ? headings.staffRequests : staffRequestDetailHeading(resident.requestId!, resident.serviceName!);
  await expect(mainHeading(page, heading)).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState('networkidle');
  await page.addStyleTag({ content: '*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important;scroll-behavior:auto!important}' });
  await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  if (state === 'list') await expect(mainContent(page).locator('.request-table').getByRole('link').first()).toBeVisible();
  if (state === 'detail' || state === 'dialog') await expect(mainContent(page).getByText('Created as Pending', { exact: true })).toBeVisible();
  if (state === 'dialog') {
    await mainContent(page).getByRole('button', { name: 'Reject', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('textbox', { name: 'Admin remarks', exact: true })).toBeFocused();
    await page.waitForLoadState('networkidle');
  }
}

async function scanStaffAxe(page: Page, state: string, scheme: 'light' | 'dark', info: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await info.attach(`axe-staff-${state}-${scheme}.json`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  const failures = results.violations.filter((item) => item.impact === 'serious' || item.impact === 'critical')
    .flatMap((item) => item.nodes.map((node) => `rule=${item.id}; impact=${item.impact}; selector=${node.target.join(', ')}; summary=${(node.failureSummary ?? item.help).replace(/\s+/g, ' ').trim()}`));
  expect(failures, failures.join('\n')).toEqual([]);
}

test.describe('staff page axe scans', () => {
  test.setTimeout(90_000);
  for (const state of ['dashboard', 'list', 'detail', 'dialog'] as const) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`axe: staff ${state} (${scheme})`, async ({ page, request }, info) => {
        await prepareStaffAxePage(page, request, state, scheme);
        await scanStaffAxe(page, state, scheme, info);
      });
    }
  }
});
