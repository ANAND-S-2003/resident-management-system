import AxeBuilder from '@axe-core/playwright';
import { randomUUID } from 'node:crypto';
import { expect, test } from './fixtures';
import type { APIRequestContext, Page, TestInfo } from '@playwright/test';
import {
  addDaysToDateOnly,
  backendApi,
  createResidentScenario,
  installSession,
  registerResident,
  residentCredentials,
  superAdminSession,
  superAdminName,
} from './support/api';
import { signIn, signOut } from './support/auth';
import { headings, residentDashboardHeading, residentFeatureHeading, type ResidentFeaturePage } from './support/headings';
import { mainContent, mainHeading, navigationLink } from './support/landmarks';
import { monitorExpectedBrowserFailures } from './support/expected-browser-failures';

async function waitForHeading(page: Page, name: string) {
  await expect(mainHeading(page, name)).toBeVisible({ timeout: 10_000 });
}

test('resident request lifecycle, notifications, ownership, and password change work end to end', async ({ page, request }) => {
  test.setTimeout(90_000);
  const browserFailures = monitorExpectedBrowserFailures(page);
  const expectedFailures: Array<{ method: string; path: string; status: number; reason: string }> = [];
  const resident = residentCredentials();
  const authForm = mainContent(page);
  await page.goto('/register');
  await authForm.locator('input[name="fullName"]').fill(resident.fullName);
  await authForm.locator('input[name="email"]').fill(resident.email);
  await authForm.locator('input[name="flatNumber"]').fill(resident.flatNumber);
  await authForm.locator('input[name="password"]').fill(resident.password);
  await authForm.locator('input[name="confirmPassword"]').fill(resident.password);
  const registrationResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/register'));
  const registrationLoginResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/login'));
  await authForm.getByRole('button', { name: 'Create account', exact: true }).click();
  expect((await registrationResponse).status(), 'Resident registration response status').toBe(201);
  expect((await registrationLoginResponse).status(), 'Automatic login after registration status').toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await waitForHeading(page, residentDashboardHeading(resident.fullName));

  await navigationLink(page, 'New request').click();
  await waitForHeading(page, headings.newRequest);
  const content = mainContent(page);
  const serviceSelect = content.locator('select[name="serviceId"]');
  await expect(serviceSelect).toBeVisible();
  const firstServiceOption = serviceSelect.locator('option').nth(1);
  await expect(firstServiceOption).toBeAttached();
  const serviceId = await firstServiceOption.getAttribute('value');
  const serviceName = (await firstServiceOption.textContent())?.trim();
  expect(serviceId, 'An active service option must have an ID').toBeTruthy();
  expect(serviceName, 'An active service option must have a name').toBeTruthy();
  await serviceSelect.selectOption(serviceId!);

  const dateInput = content.locator('input[name="expectedCompletionDate"]');
  const minimumDate = await dateInput.getAttribute('min');
  expect(minimumDate, 'Date input must expose the application-zone minimum').toBeTruthy();
  await dateInput.fill(addDaysToDateOnly(minimumDate!, 7));
  const description = `Resident issue ${randomUUID()}`;
  await content.locator('textarea[name="description"]').fill(description);
  const createResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/requests'));
  await content.getByRole('button', { name: 'Submit request', exact: true }).click();
  const createResponseValue = await createResponse;
  expect(createResponseValue.status(), 'Create request response status').toBe(201);
  const createdRequest = await createResponseValue.json() as { id: number };
  const requestId = createdRequest.id;
  const requestPath = `/resident/requests/${encodeURIComponent(String(requestId))}`;
  await expect(page).toHaveURL(new URL(requestPath, page.url()).toString(), { timeout: 10_000 });
  await waitForHeading(page, residentFeatureHeading('request-detail', { requestId, serviceName: serviceName! }));
  await expect(mainContent(page).getByText('Created as Pending', { exact: true })).toBeVisible();

  await navigationLink(page, 'Dashboard').click();
  await waitForHeading(page, residentDashboardHeading(resident.fullName));
  const recentRequestLink = mainContent(page).locator('.recent-requests').locator(`a[href="${requestPath}"]`);
  await expect(recentRequestLink).toBeVisible();
  await expect(recentRequestLink).toContainText(description);

  await navigationLink(page, 'My requests').click();
  await waitForHeading(page, headings.requests);
  const listRequestLink = mainContent(page).locator('.request-table').getByRole('link', { name: `#${requestId}`, exact: true });
  await expect(listRequestLink).toBeVisible();
  await listRequestLink.click();
  await waitForHeading(page, residentFeatureHeading('request-detail', { requestId, serviceName: serviceName! }));

  const admin = await superAdminSession(request);
  const transition = await request.patch(`${backendApi}/requests/${encodeURIComponent(String(requestId))}`, {
    headers: { Authorization: `Bearer ${admin.token}` },
    data: { status: 'IN_PROGRESS' },
  });
  expect(transition.status(), 'Admin status transition response').toBe(200);
  await page.reload();
  const notificationsLink = navigationLink(page, 'Notifications, 1 unread');
  await expect(notificationsLink).toBeVisible({ timeout: 10_000 });
  await notificationsLink.click();
  await waitForHeading(page, headings.notifications);
  const notificationMessage = mainContent(page).getByText(`Your request #${requestId} for ${serviceName} is now IN_PROGRESS.`, { exact: true });
  await expect(notificationMessage).toBeVisible();
  await mainContent(page).getByRole('button', { name: 'Mark as read', exact: true }).click();
  await expect(navigationLink(page, 'Notifications, 0 unread')).toBeVisible({ timeout: 10_000 });

  await page.goto(requestPath);
  await waitForHeading(page, residentFeatureHeading('request-detail', { requestId, serviceName: serviceName! }));
  await expect(mainContent(page).getByText('From Pending to In progress', { exact: true })).toBeVisible();
  await expect(mainContent(page).getByText(`Changed by ${await superAdminName()}`, { exact: true })).toBeVisible();

  const otherResident = residentCredentials();
  await registerResident(request, otherResident);
  const otherLoginResponse = await signIn(page, otherResident.email, otherResident.password);
  expect(otherLoginResponse.status(), 'Second resident login response status').toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await page.goto(requestPath);
  await waitForHeading(page, headings.requestNotFound);
  await expect(mainContent(page).getByRole('link', { name: 'Back to my requests', exact: true })).toBeVisible();
  expectedFailures.push({ method: 'GET', path: `/api/v1/requests/${encodeURIComponent(String(requestId))}`, status: 404, reason: 'a different resident cannot read this request' });
  browserFailures.assertExpectedFailures(expectedFailures);

  const firstLoginResponse = await signIn(page, resident.email, resident.password);
  expect(firstLoginResponse.status(), 'Original resident login response status').toBe(200);
  await page.goto('/account');
  await waitForHeading(page, headings.account);
  const account = mainContent(page);
  await account.locator('input[name="currentPassword"]').fill(resident.password);
  const newPassword = `Updated-${randomUUID().slice(0, 8)}-8b`;
  await account.locator('input[name="newPassword"]').fill(newPassword);
  await account.locator('input[name="confirmPassword"]').fill(newPassword);
  const changeResponse = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/change-password'));
  const successToast = expect(page.getByTestId('toast-region').getByRole('status').filter({ hasText: 'Password changed' })).toBeVisible({ timeout: 10_000 });
  await account.getByRole('button', { name: 'Change password', exact: true }).click();
  expect((await changeResponse).status(), 'Change password response status').toBe(204);
  await successToast;
  await signOut(page);

  const oldPasswordResponse = await signIn(page, resident.email, resident.password);
  expect(oldPasswordResponse.status(), 'Old-password login response status').toBe(401);
  await expect(page).toHaveURL(/\/login$/);
  await expect(mainContent(page).getByText('Invalid email or password', { exact: true })).toBeVisible();
  expectedFailures.push({ method: 'POST', path: '/api/v1/auth/login', status: 401, reason: 'old password was deliberately rejected after the password change' });
  browserFailures.assertExpectedFailures(expectedFailures);

  const finalLoginResponse = await signIn(page, resident.email, newPassword);
  expect(finalLoginResponse.status(), 'Login with changed password response status').toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await waitForHeading(page, residentDashboardHeading(resident.fullName));
  browserFailures.assertExpectedFailures(expectedFailures);
});

type ScanState = ResidentFeaturePage;

async function createScanState(request: APIRequestContext, state: ScanState) {
  const wantsRequest = state === 'requests-list' || state === 'request-detail' || state === 'notifications';
  const scenario = await createResidentScenario(request, wantsRequest);
  if (state === 'notifications' && scenario.requestId !== null) {
    const admin = await superAdminSession(request);
    const changed = await request.patch(`${backendApi}/requests/${encodeURIComponent(String(scenario.requestId))}`, {
      headers: { Authorization: `Bearer ${admin.token}` },
      data: { status: 'IN_PROGRESS' },
    });
    expect(changed.status(), 'Create notification for axe scan').toBe(200);
  }
  return scenario;
}

async function scanAxe(page: Page, state: ScanState, scheme: 'light' | 'dark', info: TestInfo) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  await info.attach(`axe-resident-${state}-${scheme}.json`, { body: JSON.stringify(results, null, 2), contentType: 'application/json' });
  const failures = results.violations
    .filter((item) => item.impact === 'critical' || item.impact === 'serious')
    .flatMap((item) => item.nodes.map((node) => `rule=${item.id}; impact=${item.impact}; selector=${node.target.join(', ')}; summary=${(node.failureSummary ?? item.help).replace(/\s+/g, ' ').trim()}`));
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
        const path = state === 'dashboard' ? '/resident'
          : state === 'new-request' ? '/resident/requests/new'
            : state === 'requests-list' ? '/resident/requests'
              : state === 'request-detail' ? `/resident/requests/${encodeURIComponent(String(scenario.requestId))}`
                : state === 'notifications' ? '/resident/notifications' : '/account';
        await page.goto(path);
        const heading = residentFeatureHeading(state, {
          fullName: scenario.resident.fullName,
          requestId: scenario.requestId ?? undefined,
          serviceName: scenario.serviceName ?? undefined,
        });
        await waitForHeading(page, heading);
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
  await waitForHeading(page, headings.requests);
  await expect(mainContent(page).locator('.request-mobile-cards')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
