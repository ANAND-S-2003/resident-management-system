import { expect, type Page, type Response as PlaywrightResponse } from '@playwright/test';
import { appHeader, mainContent } from './landmarks';
import { headings } from './headings';

export async function signIn(page: Page, email: string, password: string): Promise<PlaywrightResponse> {
  await page.goto('/login');
  const authForm = mainContent(page);
  await authForm.locator('input[name="email"]').fill(email);
  await authForm.locator('input[name="password"]').fill(password);
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
}
