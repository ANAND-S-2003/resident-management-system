import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";
import type { APIRequestContext, Page, TestInfo } from "@playwright/test";
import {
  assertNotRateLimited,
  createReadOnlyResident,
  installSession,
  loginWithApi,
  residentCredentials,
  superAdminSession,
} from "./support/api";
import { signIn, signInSuperAdmin, signOut } from "./support/auth";
import {
  axePageHeading,
  headings,
  residentDashboardHeading,
} from "./support/headings";
import {
  appHeader,
  mainContent,
  mainHeading,
  mobileDrawer,
  navigationLink,
} from "./support/landmarks";
import { monitorExpectedBrowserFailures } from "./support/expected-browser-failures";

type AxePageState =
  | "login"
  | "register"
  | "resident-desktop"
  | "resident-mobile"
  | "super-admin-desktop"
  | "super-admin-mobile";

async function disableMotionForScan(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addStyleTag({
    content:
      "*, *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition-duration: 0s !important; transition-delay: 0s !important; scroll-behavior: auto !important; }",
  });
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

async function prepareAxePage(
  page: Page,
  request: APIRequestContext,
  state: AxePageState,
  scheme: "light" | "dark",
) {
  await page.emulateMedia({ colorScheme: scheme, reducedMotion: "reduce" });
  const mobile = state === "resident-mobile" || state === "super-admin-mobile";
  await page.setViewportSize(
    mobile ? { width: 375, height: 667 } : { width: 1280, height: 800 },
  );

  let residentName: string | undefined;
  if (state === "login" || state === "register") {
    await page.goto(state === "login" ? "/login" : "/register");
  } else {
    const session = state.startsWith("resident")
      ? await loginWithResident(request)
      : await superAdminSession(request);
    residentName = state.startsWith("resident")
      ? session.user.fullName
      : undefined;
    await installSession(page, session);
    await page.goto(state.startsWith("resident") ? "/resident" : "/admin");
  }

  await expect(
    mainHeading(page, axePageHeading(state, residentName)),
    `${state} main heading`,
  ).toBeVisible({ timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  await disableMotionForScan(page);

  if (mobile) {
    await appHeader(page)
      .getByRole("button", { name: "Open navigation menu", exact: true })
      .click();
    const drawer = mobileDrawer(page);
    await expect(drawer).toBeVisible();
    await expect(
      drawer.getByRole("button", {
        name: "Close navigation menu",
        exact: true,
      }),
    ).toBeFocused();
    await page.waitForLoadState("networkidle");
  }
}

async function loginWithResident(request: APIRequestContext) {
  const resident = await createReadOnlyResident(request);
  return loginWithApi(request, resident.email, resident.password);
}

async function scanAxeAndAttach(
  page: Page,
  state: AxePageState,
  scheme: "light" | "dark",
  testInfo: TestInfo,
) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await testInfo.attach(`axe-${state}-${scheme}.json`, {
    body: JSON.stringify(results, null, 2),
    contentType: "application/json",
  });
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  const failures = serious.flatMap((violation) =>
    violation.nodes.map(
      (node) =>
        `rule=${violation.id}; impact=${violation.impact}; selector=${node.target.join(", ")}; summary=${(node.failureSummary ?? violation.help).replace(/\s+/g, " ").trim()}`,
    ),
  );
  expect(
    failures,
    failures.length
      ? `Axe findings for ${state} (${scheme}):\n${failures.map((failure, index) => `${index + 1}. ${failure}`).join("\n")}`
      : `Axe findings for ${state} (${scheme})`,
  ).toEqual([]);
}

test("login renders without browser console or page errors", async ({
  page,
}) => {
  const browserFailures = monitorExpectedBrowserFailures(page);
  await page.goto("/login");
  await expect(mainHeading(page, headings.login)).toBeVisible();
  await expect(mainContent(page).locator('input[name="email"]')).toBeVisible();
  await expect(
    mainContent(page).locator('input[name="password"]'),
  ).toBeVisible();
  browserFailures.assertExpectedFailures([]);
});

test("a resident registers, signs out, and signs back in", async ({ page }) => {
  const resident = residentCredentials();
  const authForm = mainContent(page);
  await page.goto("/register");
  await authForm.locator('input[name="fullName"]').fill(resident.fullName);
  await authForm.locator('input[name="email"]').fill(resident.email);
  await authForm.locator('input[name="flatNumber"]').fill(resident.flatNumber);
  await authForm.locator('input[name="password"]').fill(resident.password);
  await authForm
    .locator('input[name="confirmPassword"]')
    .fill(resident.password);
  const registrationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/auth/register"),
  );
  const loginResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname.endsWith("/auth/login"),
  );
  await authForm
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  const registrationResult = await registrationResponse;
  assertNotRateLimited(registrationResult.status(), "UI resident registration");
  expect(
    registrationResult.status(),
    "Resident registration response status",
  ).toBe(201);
  expect((await loginResponse).status(), "Resident login response status").toBe(
    200,
  );
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  const dashboardHeading = residentDashboardHeading(resident.fullName);
  await expect(mainHeading(page, dashboardHeading)).toBeVisible();
  await signOut(page);
  await signIn(page, resident.email, resident.password);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await expect(mainHeading(page, dashboardHeading)).toBeVisible();
});

test("wrong password shows the generic login error", async ({
  page,
  request,
}) => {
  const browserFailures = monitorExpectedBrowserFailures(page);
  const resident = await createReadOnlyResident(request);
  const response = await signIn(page, resident.email, "WrongPassword123");
  expect(response.status(), "Wrong-password login response status").toBe(401);
  await expect(
    mainContent(page).getByText("Invalid email or password", { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  browserFailures.assertExpectedFailures([
    {
      method: "POST",
      path: "/api/v1/auth/login",
      status: 401,
      reason: "wrong password is deliberately rejected",
    },
  ]);
});

test("SUPER_ADMIN signs in and sees the Admins navigation item", async ({
  page,
}) => {
  await signInSuperAdmin(page);
  await expect(navigationLink(page, "Admins")).toBeVisible();
});

test("a resident visiting /admin sees Forbidden", async ({ page, request }) => {
  const resident = await createReadOnlyResident(request);
  const response = await signIn(page, resident.email, resident.password);
  expect(response.status(), "Resident login response status").toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  await page.goto("/admin");
  await expect(mainHeading(page, headings.forbidden)).toBeVisible();
});

test("browser Back after logout does not reveal protected content", async ({
  page,
  request,
}) => {
  const authenticatedRequestsAfterSignOut: string[] = [];
  let signedOut = false;
  page.on("request", async (browserRequest) => {
    if (
      !signedOut ||
      !new URL(browserRequest.url()).pathname.startsWith("/api/v1/")
    )
      return;
    const headers = await browserRequest.allHeaders();
    if (headers.authorization?.startsWith("Bearer "))
      authenticatedRequestsAfterSignOut.push(browserRequest.url());
  });
  const resident = await createReadOnlyResident(request);
  const response = await signIn(page, resident.email, resident.password);
  expect(response.status(), "Resident login response status").toBe(200);
  await expect(
    mainHeading(page, residentDashboardHeading(resident.fullName)),
  ).toBeVisible();
  await signOut(page);
  signedOut = true;
  await page.goBack();
  await expect(
    mainHeading(page, residentDashboardHeading(resident.fullName)),
  ).toHaveCount(0);
  await page.goto("/resident");
  await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  await expect(mainHeading(page, headings.login)).toBeVisible();
  await expect(mainContent(page).locator('input[name="email"]')).toBeVisible();
  await expect
    .poll(
      () =>
        page.evaluate(() => window.sessionStorage.getItem("rms.session.v1")),
      {
        message:
          "Session storage should remain empty after Back and protected-route navigation",
        timeout: 10_000,
      },
    )
    .toBeNull();
  await page.waitForLoadState("networkidle");
  expect(
    authenticatedRequestsAfterSignOut,
    "Protected API requests after sign-out",
  ).toEqual([]);
});

test("mobile navigation traps focus, closes with Escape, and fits the viewport", async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 375, height: 667 });
  const resident = await createReadOnlyResident(request);
  const response = await signIn(page, resident.email, resident.password);
  expect(response.status(), "Resident login response status").toBe(200);
  await expect(page).toHaveURL(/\/resident$/, { timeout: 10_000 });
  const openButton = appHeader(page).getByRole("button", {
    name: "Open navigation menu",
    exact: true,
  });
  await openButton.click();
  const drawer = mobileDrawer(page);
  const closeButton = drawer.getByRole("button", {
    name: "Close navigation menu",
    exact: true,
  });
  await expect(closeButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(drawer.locator('a[href="/account"]')).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(openButton).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test.describe("per-page axe scans", () => {
  test.setTimeout(90_000);
  const pageStates = [
    { state: "login" as const, title: "login" },
    { state: "register" as const, title: "register" },
    { state: "resident-desktop" as const, title: "resident shell (desktop)" },
    {
      state: "resident-mobile" as const,
      title: "resident mobile drawer open (375x667)",
    },
    {
      state: "super-admin-desktop" as const,
      title: "SUPER_ADMIN shell (desktop)",
    },
    {
      state: "super-admin-mobile" as const,
      title: "SUPER_ADMIN mobile drawer open (375x667)",
    },
  ];
  const schemes = ["light", "dark"] as const;

  for (const { state, title } of pageStates) {
    for (const scheme of schemes) {
      test(`axe: ${title} (${scheme})`, async ({ page, request }, testInfo) => {
        await prepareAxePage(page, request, state, scheme);
        await scanAxeAndAttach(page, state, scheme, testInfo);
      });
    }
  }
});
