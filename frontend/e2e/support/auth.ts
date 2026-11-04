import { expect, type Page, type Response as PlaywrightResponse } from '@playwright/test';
import { appHeader, mainContent } from './landmarks';
import { headings } from './headings';

export async function signIn(page: Page, email: string, password: string): Promise<PlaywrightResponse> {
  await page.goto('/login');
  const authForm = mainContent(page);
  const emailInput = authForm.locator('input[name="email"]');
  const passwordInput = authForm.locator('input[name="password"]');
  const signOutControl = appHeader(page).getByRole('button', { name: 'Sign out', exact: true });
  await expect.poll(async () => (await emailInput.isVisible()) || (await signOutControl.isVisible()), {
    message: 'Login form or authenticated app shell should render before sign-in',
    timeout: 10_000,
  }).toBe(true);

  if (await signOutControl.isVisible()) {
    await signOut(page);
  } else if (!(await emailInput.isVisible())) {
    await page.evaluate(() => {
      try { window.sessionStorage.removeItem('rms.session.v1'); } catch { /* Storage may be unavailable. */ }
    });
    await page.reload();
  }

  await expect(emailInput, 'Login email field should be visible before entering credentials').toBeVisible({ timeout: 10_000 });
  await expect(passwordInput, 'Login password field should be visible before entering credentials').toBeVisible({ timeout: 10_000 });
  await emailInput.fill(email);
  await passwordInput.fill(password);
  const loginResponse = page.waitForResponse((response) =>
    response.request().method() === 'POST' && new URL(response.url()).pathname.endsWith('/auth/login'),
  );
  await authForm.getByRole('button', { name: 'Sign in', exact: true }).click();
  return loginResponse;
}

export async function signInSuperAdmin(page: Page): Promise<PlaywrightResponse> {
  const email = process.env.RMS_SUPERADMIN_EMAIL;
  const password = process.env.RMS_SUPERADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('Super admin E2E credentials are missing; load them with scripts/load-env.ps1.');
  }
  const response = await signIn(page, email, password);
  expect(response.status(), 'Super admin login response status').toBe(200);
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 });
  await expect(mainContent(page).getByRole('heading', { name: headings.staffDashboard, exact: true })).toBeVisible();
  return response;
}

export async function signOut(page: Page): Promise<void> {
  await appHeader(page).getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  await expect(mainContent(page).locator('input[name="email"]'), 'Login form should render after sign-out').toBeVisible({ timeout: 10_000 });
  await expect.poll(() => page.evaluate(() => window.sessionStorage.getItem('rms.session.v1')),
    { message: 'Session storage should be cleared after sign-out', timeout: 10_000 },
  ).toBeNull();
}
