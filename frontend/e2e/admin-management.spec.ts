import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { expect, test } from "./fixtures";
import type { Page, TestInfo } from "@playwright/test";
import {
  adminCredentials,
  assertNotRateLimited,
  backendApi,
  createReadOnlyStaff,
  createResidentScenario,
  installSession,
  loginWithApi,
  residentCredentials,
  superAdminSession,
} from "./support/api";
import { signIn, signInSuperAdmin, signOut } from "./support/auth";
import { headings } from "./support/headings";
import {
  expectToast,
  mainContent,
  mainHeading,
  messageDetails,
  navigateTo,
} from "./support/landmarks";
import { monitorExpectedBrowserFailures } from "./support/expected-browser-failures";

function suffix() {
  return randomUUID().replaceAll("-", "").slice(0, 10);
}
async function fillUserForm(
  dialog: ReturnType<Page["getByRole"]>,
  input: { name: string; email: string; flat?: string; password: string },
) {
  await dialog.getByRole("textbox", { name: "Full name" }).fill(input.name);
  await dialog.getByRole("textbox", { name: "Email" }).fill(input.email);
  if (input.flat !== undefined)
    await dialog.getByRole("textbox", { name: "Flat number" }).fill(input.flat);
  await dialog.getByLabel("Initial password").fill(input.password);
}
async function runAxe(
  page: Page,
  state: string,
  scheme: "light" | "dark",
  info: TestInfo,
) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  await info.attach(`axe-${state}-${scheme}.json`, {
    body: JSON.stringify(result, null, 2),
    contentType: "application/json",
  });
  const issues = result.violations
    .filter((item) => item.impact === "serious" || item.impact === "critical")
    .flatMap((item) =>
      item.nodes.map(
        (node) =>
          `${item.id} (${item.impact}) ${node.target.join(", ")}: ${(node.failureSummary ?? item.help).replace(/\s+/g, " ").trim()}`,
      ),
    );
  expect(issues, issues.join("\n")).toEqual([]);
}

test("SUPER_ADMIN creates an ADMIN in the UI and ADMIN receives the forbidden screen", async ({
  page,
}) => {
  const superSession = await signInSuperAdmin(page);
  expect(superSession.status()).toBe(200);
  await navigateTo(page, "Admins");
  await expect(mainHeading(page, "Admins")).toBeVisible();
  await page.getByRole("button", { name: "Add admin" }).click();
  const dialog = page.getByRole("dialog");
  const admin = adminCredentials();
  await fillUserForm(dialog, {
    name: admin.fullName,
    email: admin.email,
    password: admin.password,
  });
  const response = page.waitForResponse(
    (value) =>
      value.request().method() === "POST" &&
      new URL(value.url()).pathname === "/api/v1/users",
  );
  const toast = expectToast(page, "Admin created successfully.");
  await dialog.getByRole("button", { name: "Create" }).click();
  const created = await response;
  assertNotRateLimited(created.status(), "admin creation in UI");
  expect(created.status()).toBe(201);
  await toast;
  await signOut(page);
  const login = await signIn(page, admin.email, admin.password);
  expect(login.status()).toBe(200);
  await expect(mainHeading(page, headings.staffDashboard)).toBeVisible();
  await expect(
    mainContent(page).getByRole("link", { name: "Admins", exact: true }),
  ).toHaveCount(0);
  await page.goto("/admin/admins");
  await expect(mainHeading(page, headings.forbidden)).toBeVisible();
});

test("ADMIN creates, edits, deactivates and reactivates a resident account", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(90_000);
  const staff = await createReadOnlyStaff(request);
  const resident = residentCredentials();
  await signIn(page, staff.admin.email, staff.admin.password);
  await navigateTo(page, "Residents");
  await expect(mainHeading(page, "Residents")).toBeVisible();
  await page.getByRole("button", { name: "Add resident" }).click();
  let dialog = page.getByRole("dialog");
  await fillUserForm(dialog, {
    name: resident.fullName,
    email: resident.email,
    flat: resident.flatNumber,
    password: resident.password,
  });
  const createResponse = page.waitForResponse(
    (value) =>
      value.request().method() === "POST" &&
      new URL(value.url()).pathname === "/api/v1/users",
  );
  await dialog.getByRole("button", { name: "Create" }).click();
  const created = await createResponse;
  assertNotRateLimited(created.status(), "resident creation in UI");
  expect(created.status()).toBe(201);
  const residentData = (await created.json()) as { id: number };
  const row = mainContent(page)
    .locator(".management-table-wrap tr")
    .filter({ hasText: resident.email });
  await row.getByRole("button", { name: "Edit" }).click();
  dialog = page.getByRole("dialog");
  await dialog
    .getByRole("textbox", { name: "Flat number" })
    .fill(`E-${suffix().slice(0, 6)}`);
  const updateResponse = page.waitForResponse(
    (value) =>
      value.request().method() === "PUT" &&
      new URL(value.url()).pathname === `/api/v1/users/${residentData.id}`,
  );
  await dialog.getByRole("button", { name: "Save changes" }).click();
  expect((await updateResponse).status()).toBe(200);
  const residentSession = await loginWithApi(
    request,
    resident.email,
    resident.password,
  );
  const residentContext = await browser.newContext();
  const residentPage = await residentContext.newPage();
  const browserFailures = monitorExpectedBrowserFailures(residentPage);
  const residentApiRequests: string[] = [];
  residentPage.on("request", (apiRequest) => {
    const url = new URL(apiRequest.url());
    if (url.pathname.startsWith("/api/v1/")) {
      residentApiRequests.push(`${apiRequest.method()} ${url.pathname}`);
    }
  });
  await installSession(residentPage, residentSession);
  await residentPage.goto("/resident");
  await expect(
    mainHeading(residentPage, `Welcome, ${resident.fullName.split(" ")[0]}`),
  ).toBeVisible();
  await row.getByRole("button", { name: "Deactivate" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/signed out immediately/i)).toBeVisible();
  const deactivateResponse = page.waitForResponse(
    (value) =>
      value.request().method() === "PATCH" &&
      new URL(value.url()).pathname.endsWith(
        `/users/${residentData.id}/activation`,
      ),
  );
  await dialog.getByRole("button", { name: "Deactivate" }).click();
  expect((await deactivateResponse).status()).toBe(200);
  await residentPage.goto("/resident/requests");
  await expect(mainHeading(residentPage, headings.login)).toBeVisible();
  const apiRequestCountAfterLogout = residentApiRequests.length;
  await residentPage.waitForTimeout(3_000);
  expect(
    residentApiRequests,
    "No API requests should be sent for three seconds after the deactivated session is rejected",
  ).toHaveLength(apiRequestCountAfterLogout);
  const badLogin = await signIn(
    residentPage,
    resident.email,
    resident.password,
  );
  expect(badLogin.status()).toBe(401);
  await expect(
    mainContent(residentPage).getByText("Invalid email or password"),
  ).toBeVisible();
  const toast = expectToast(page, "Account reactivated.");
  await row.getByRole("button", { name: "Reactivate" }).click();
  await toast;
  const goodLogin = await signIn(
    residentPage,
    resident.email,
    resident.password,
  );
  expect(goodLogin.status()).toBe(200);
  await expect(
    mainHeading(residentPage, `Welcome, ${resident.fullName.split(" ")[0]}`),
  ).toBeVisible();
  browserFailures.assertExpectedFailures([
    {
      method: "GET",
      path: "/api/v1/auth/me",
      status: 401,
      reason: "deactivated resident session is rejected during startup validation",
    },
    {
      method: "POST",
      path: "/api/v1/auth/login",
      status: 401,
      reason: "inactive resident login is rejected",
    },
  ]);
  await residentContext.close();
});

test("ADMIN activates a service for residents and the contact inbox distinguishes visitors from signed-in residents", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(90_000);
  const staff = await createReadOnlyStaff(request);
  await signIn(page, staff.admin.email, staff.admin.password);
  await navigateTo(page, "Services");
  const serviceName = `E2E Service ${suffix()}`;
  await page.getByRole("button", { name: "Add service" }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByRole("textbox", { name: "Name" }).fill(serviceName);
  await dialog
    .getByRole("textbox", { name: "Description" })
    .fill("Unique local E2E service");
  const addService = page.waitForResponse(
    (value) =>
      value.request().method() === "POST" &&
      new URL(value.url()).pathname === "/api/v1/services",
  );
  await dialog.getByRole("button", { name: "Create service" }).click();
  expect((await addService).status()).toBe(201);
  const resident = await createResidentScenario(request, false);
  const residentPage = await browser.newPage();
  await installSession(residentPage, resident.session);
  await residentPage.goto("/resident/requests/new");
  await expect(residentPage.locator('select[name="serviceId"]')).toContainText(
    serviceName,
  );
  const serviceRow = mainContent(page)
    .locator(".management-table-wrap tr")
    .filter({ hasText: serviceName });
  await serviceRow.getByRole("button", { name: "Deactivate" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Existing requests keep it.");
  const deactivate = page.waitForResponse(
    (value) =>
      value.request().method() === "PATCH" &&
      new URL(value.url()).pathname.includes("/services/"),
  );
  await dialog.getByRole("button", { name: "Deactivate" }).click();
  expect((await deactivate).status()).toBe(200);
  await residentPage.reload();
  await expect(
    residentPage.locator('select[name="serviceId"]'),
  ).not.toContainText(serviceName);
  const toast = expectToast(page, "Service reactivated.");
  await serviceRow.getByRole("button", { name: "Reactivate" }).click();
  await toast;
  await residentPage.reload();
  await expect(residentPage.locator('select[name="serviceId"]')).toContainText(
    serviceName,
  );
  await residentPage.close();
});

test("public contact submissions appear in the staff inbox with their sender type", async ({
  page,
  request,
  browser,
}) => {
  test.setTimeout(90_000);
  const visitorSubject = `Visitor ${suffix()}`;
  await page.goto("/contact");
  await page.getByRole("textbox", { name: "Name" }).fill("E2E Visitor");
  await page
    .getByRole("textbox", { name: "Email" })
    .fill(`visitor-${suffix()}@example.test`);
  await page.getByRole("textbox", { name: "Subject" }).fill(visitorSubject);
  await page
    .getByRole("textbox", { name: "Message" })
    .fill("A unique anonymous message for local testing.");
  const visitorResponse = page.waitForResponse(
    (value) =>
      value.request().method() === "POST" &&
      new URL(value.url()).pathname === "/api/v1/contact-queries",
  );
  await page.getByRole("button", { name: "Send message" }).click();
  const posted = await visitorResponse;
  assertNotRateLimited(posted.status(), "anonymous contact submission");
  expect(posted.status()).toBe(201);
  await expect(
    mainContent(page).getByRole("heading", {
      name: "Thanks, we received your message",
    }),
  ).toBeVisible();
  const staff = await createReadOnlyStaff(request);
  await signIn(page, staff.admin.email, staff.admin.password);
  await navigateTo(page, "Messages");
  await expect(
    mainContent(page).getByRole("link", { name: visitorSubject }),
  ).toBeVisible();
  await mainContent(page).getByRole("link", { name: visitorSubject }).click();
  await expect(mainHeading(page, visitorSubject)).toBeVisible();
  await expect(
    messageDetails(page).getByText("Visitor", { exact: true }),
  ).toBeVisible();
  const resident = await createResidentScenario(request, false);
  const signedSubject = `Resident ${suffix()}`;
  const signed = await browser.newPage();
  await installSession(signed, resident.session);
  await signed.goto("/contact");
  await signed.getByRole("textbox", { name: "Subject" }).fill(signedSubject);
  await signed
    .getByRole("textbox", { name: "Message" })
    .fill("A unique authenticated message.");
  const signedResponse = signed.waitForResponse(
    (value) =>
      value.request().method() === "POST" &&
      new URL(value.url()).pathname === "/api/v1/contact-queries",
  );
  await signed.getByRole("button", { name: "Send message" }).click();
  expect((await signedResponse).status()).toBe(201);
  await page.goto("/admin/messages");
  await expect(
    mainContent(page).getByRole("link", { name: signedSubject }),
  ).toBeVisible();
  await mainContent(page).getByRole("link", { name: signedSubject }).click();
  await expect(
    messageDetails(page).getByText("Signed-in resident", { exact: true }),
  ).toBeVisible();
  await signed.close();
});

test("mobile residents list uses cards without horizontal scrolling", async ({
  page,
  request,
}) => {
  const staff = await createReadOnlyStaff(request);
  await page.setViewportSize({ width: 375, height: 667 });
  await signIn(page, staff.admin.email, staff.admin.password);
  await navigateTo(page, "Residents");
  await expect(mainHeading(page, "Residents")).toBeVisible();
  await expect(mainContent(page).locator(".management-cards")).toBeVisible();
  await expect(
    mainContent(page).locator(".management-table-wrap"),
  ).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test.describe("management and contact axe scans", () => {
  test.setTimeout(90_000);
  for (const state of [
    "residents",
    "resident-dialog",
    "services",
    "messages",
    "message-detail",
    "admins",
    "contact",
  ] as const)
    for (const scheme of ["light", "dark"] as const) {
      test(`axe: ${state} (${scheme})`, async ({ page, request }, info) => {
        await page.emulateMedia({
          colorScheme: scheme,
          reducedMotion: "reduce",
        });
        await page.setViewportSize({ width: 1280, height: 800 });
        if (state === "contact") {
          await page.goto("/contact");
          await expect(mainHeading(page, "Contact us")).toBeVisible();
        } else if (state === "admins") {
          const session = await superAdminSession(request);
          await installSession(page, session);
          await page.goto("/admin/admins");
          await expect(mainHeading(page, "Admins")).toBeVisible();
        } else {
          const staff = await createReadOnlyStaff(request);
          await installSession(page, staff.session);
          const path =
            state === "residents" || state === "resident-dialog"
              ? "/admin/residents"
              : state === "services"
                ? "/admin/services"
                : state === "message-detail"
                  ? "/admin/messages/1"
                  : "/admin/messages";
          if (state === "message-detail") {
            const subject = `Axe message ${suffix()}`;
            const response = await request.post(
              `${backendApi}/contact-queries`,
              {
                headers: { Authorization: `Bearer ${staff.session.token}` },
                data: {
                  name: "Axe resident",
                  email: `axe-${suffix()}@example.test`,
                  subject,
                  message: "A message used for an axe scan.",
                },
              },
            );
            expect(response.status()).toBe(201);
            const query = (await response.json()) as { id: number };
            await page.goto(
              `/admin/messages/${encodeURIComponent(String(query.id))}`,
            );
            await expect(mainHeading(page, subject)).toBeVisible();
            await page.waitForLoadState("networkidle");
            await page.addStyleTag({
              content:
                "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}",
            });
            await runAxe(page, state, scheme, info);
            return;
          } else await page.goto(path);
          const expectedHeading =
            state === "services"
              ? "Services"
              : state === "messages"
                ? "Messages"
                : "Residents";
          await expect(mainHeading(page, expectedHeading)).toBeVisible();
          if (state === "resident-dialog") {
            await page.getByRole("button", { name: "Add resident" }).click();
            await expect(page.getByRole("dialog")).toBeVisible();
          }
        }
        await page.waitForLoadState("networkidle");
        await page.addStyleTag({
          content:
            "*,*::before,*::after{animation-duration:0s!important;transition-duration:0s!important}",
        });
        await runAxe(page, state, scheme, info);
      });
    }
});
