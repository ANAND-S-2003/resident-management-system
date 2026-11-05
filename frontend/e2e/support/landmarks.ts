import { expect, type Locator, type Page } from '@playwright/test';

export const mainContent = (page: Page): Locator => page.locator('main');
export const mainNavigation = (page: Page): Locator => page.getByRole('navigation', { name: 'Main navigation' });
export const appHeader = (page: Page): Locator => page.getByRole('banner');
export const mobileDrawer = (page: Page): Locator => page.getByRole('dialog', { name: 'Mobile navigation' });

/** Mirrors src/features/notifications/notifications-label.ts for browser-test locators. */
export function notificationsLinkName(count: number): string {
  return count > 0 ? `Notifications, ${count} unread` : 'Notifications';
}

export function mainHeading(page: Page, name: string): Locator {
  return mainContent(page).getByRole('heading', { name, exact: true });
}

export function pageLink(page: Page, name: string): Locator {
  return mainContent(page).getByRole('link', { name, exact: true });
}

export function navigationLink(page: Page, name: string): Locator {
  return mainNavigation(page).getByRole('link', { name, exact: true });
}

/** Navigate through the visible navigation landmark, opening the mobile drawer when needed. */
export async function navigateTo(page: Page, name: string): Promise<void> {
  const menuButton = appHeader(page).getByRole('button', { name: 'Open navigation menu', exact: true });
  let link: Locator;
  if (await menuButton.isVisible()) {
    await menuButton.click();
    const drawer = mobileDrawer(page);
    await expect(drawer).toBeVisible();
    link = drawer.getByRole('navigation', { name: 'Mobile navigation menu', exact: true })
      .getByRole('link', { name, exact: true });
  } else {
    link = navigationLink(page, name);
  }

  await expect(link).toBeVisible();
  const href = await link.getAttribute('href');
  if (!href) throw new Error(`Navigation link "${name}" has no href.`);
  const target = new URL(href, page.url());
  const current = new URL(page.url());
  if (target.pathname === current.pathname && target.search === current.search && target.hash === current.hash) {
    await link.click();
    return;
  }
  await Promise.all([
    page.waitForURL((url) => url.pathname === target.pathname && url.search === target.search && url.hash === target.hash),
    link.click(),
  ]);
}

export function signOutButton(page: Page): Locator {
  return appHeader(page).getByRole('button', { name: 'Sign out', exact: true });
}
