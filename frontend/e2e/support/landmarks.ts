import type { Locator, Page } from '@playwright/test';

export const mainContent = (page: Page): Locator => page.locator('main');
export const mainNavigation = (page: Page): Locator => page.getByRole('navigation', { name: 'Main navigation' });
export const appHeader = (page: Page): Locator => page.getByRole('banner');
export const mobileDrawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Mobile navigation' });

export function mainHeading(page: Page, name: string): Locator {
  return mainContent(page).getByRole('heading', { name, exact: true });
}

export function pageLink(page: Page, name: string): Locator {
  return mainContent(page).getByRole('link', { name, exact: true });
}

export function navigationLink(page: Page, name: string): Locator {
  return mainNavigation(page).getByRole('link', { name, exact: true });
}

export function signOutButton(page: Page): Locator {
  return appHeader(page).getByRole('button', { name: 'Sign out', exact: true });
}
