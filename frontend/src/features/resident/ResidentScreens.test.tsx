import { createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { App } from "@/app/App";
import { appRoutes } from "@/app/router";
import { clearStoredSession, writeSession } from "@/features/auth/session";
import type { NotificationItem, ServiceRequest } from "@/lib/api/types";
import { getApplicationToday } from "@/lib/dates";
import { testApiUrl } from "@/test/api-url";
import { server } from "@/test/server";
import { notificationsLabel } from "@/features/notifications/notifications-label";

const userProfile = {
  id: 55,
  fullName: "Ravi Resident",
  email: "ravi@example.test",
  role: "USER" as const,
  flatNumber: "B-55",
  active: true,
};
const requestItem: ServiceRequest = {
  id: 701,
  resident: { id: userProfile.id, fullName: userProfile.fullName },
  flatNumber: "B-55",
  service: { id: 8, name: "Plumbing" },
  description: "A tap is leaking",
  requestDate: "2026-11-02",
  expectedCompletionDate: "2026-11-12",
  status: "PENDING",
  adminRemarks: null,
  version: 0,
  overdue: false,
  createdAt: "2026-11-02T08:00:00Z",
  updatedAt: "2026-11-02T08:00:00Z",
};
const services = [
  {
    id: 8,
    name: "Plumbing",
    description: "Leaks and pipe repairs",
    active: true,
  },
];
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
const emptyPage = <T,>(
  content: T[] = [],
  totalElements = content.length,
  page = 0,
  size = 20,
) => ({
  content,
  page,
  size,
  totalElements,
  totalPages: Math.ceil(totalElements / size),
});
function futureDate(days: number): string {
  const [year, month, day] = getApplicationToday().split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function renderApp(path: string) {
  writeSession({
    token: "mock-session-token",
    expiresAt: "2099-12-31T23:59:59Z",
    user: userProfile,
  });
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return { ...render(<App router={router} />), router };
}

function installBaseHandlers() {
  server.use(
    http.get(testApiUrl("/auth/me"), () => HttpResponse.json(userProfile)),
    http.get(testApiUrl("/services"), () =>
      HttpResponse.json(emptyPage(services, services.length, 0, 100)),
    ),
    http.get(testApiUrl("/requests"), ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get("status");
      const overdue = url.searchParams.get("overdue");
      if (status)
        return HttpResponse.json(
          emptyPage(
            status === "PENDING" ? [requestItem] : [],
            status === "PENDING" ? 1 : 0,
            Number(url.searchParams.get("page") ?? 0),
            Number(url.searchParams.get("size") ?? 20),
          ),
        );
      if (overdue === "true")
        return HttpResponse.json(
          emptyPage(
            [],
            0,
            Number(url.searchParams.get("page") ?? 0),
            Number(url.searchParams.get("size") ?? 20),
          ),
        );
      return HttpResponse.json(
        emptyPage(
          [],
          0,
          Number(url.searchParams.get("page") ?? 0),
          Number(url.searchParams.get("size") ?? 20),
        ),
      );
    }),
    http.get(testApiUrl("/requests/:id"), () => HttpResponse.json(requestItem)),
    http.get(testApiUrl("/requests/:id/history"), () => HttpResponse.json([])),
    http.get(testApiUrl("/notifications/unread-count"), () =>
      HttpResponse.json({ count: 0 }),
    ),
    http.get(testApiUrl("/notifications"), () =>
      HttpResponse.json(emptyPage([])),
    ),
  );
}

describe("resident screens in the production app composition", () => {
  beforeEach(() => {
    server.resetHandlers();
    installBaseHandlers();
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    clearStoredSession();
  });

  it("builds dashboard cards from filtered request totals and links to their filters", async () => {
    server.use(
      http.get(testApiUrl("/requests"), ({ request }) => {
        const params = new URL(request.url).searchParams;
        const totals: Record<string, number> = {
          PENDING: 3,
          IN_PROGRESS: 2,
          COMPLETED: 4,
          REJECTED: 1,
        };
        const status = params.get("status");
        return HttpResponse.json(
          emptyPage(
            [],
            status ? totals[status] : params.get("overdue") === "true" ? 2 : 10,
            0,
            1,
          ),
        );
      }),
    );
    server.use(
      http.get(testApiUrl("/notifications/unread-count"), () =>
        HttpResponse.json({ count: 6 }),
      ),
    );
    renderApp("/resident");
    expect(
      await screen.findByRole("heading", { name: "Welcome, Ravi" }),
    ).toBeInTheDocument();
    expect(
      await within(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).findByRole("link", { name: notificationsLabel(6) }),
    ).toBeVisible();
    expect(
      await within(screen.getByRole("main")).findByRole("link", {
        name: notificationsLabel(6),
      }),
    ).toBeVisible();
    await waitFor(() =>
      expect(
        document.querySelector('a[href="/resident/requests?status=PENDING"]'),
      ).not.toBeNull(),
    );
    expect(
      document.querySelector('a[href="/resident/requests?status=IN_PROGRESS"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('a[href="/resident/requests?overdue=true"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('a[href="/resident/notifications"]'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create your first request" }),
    ).toHaveAttribute("href", "/resident/requests/new");
  });

  it("keeps visible dashboard card text inside each link accessible name", async () => {
    renderApp("/resident");
    expect(
      await screen.findByRole("heading", { name: "Welcome, Ravi" }),
    ).toBeInTheDocument();
    const navNotifications = within(
      screen.getByRole("navigation", { name: "Main navigation" }),
    );
    const main = within(screen.getByRole("main"));
    const notificationsCard = await main.findByRole("link", {
      name: notificationsLabel(0),
    });
    expect(notificationsCard).not.toHaveAttribute("aria-label");
    expect(notificationsCard).toHaveAccessibleName(notificationsLabel(0));
    expect(
      await navNotifications.findByRole("link", {
        name: notificationsLabel(0),
      }),
    ).toBeVisible();
    const statLinks = Array.from(
      document.querySelectorAll<HTMLAnchorElement>(".resident-stat-link"),
    );
    expect(statLinks).toHaveLength(6);
    for (const link of statLinks) {
      expect(link).not.toHaveAttribute("aria-label");
      expect(link).toHaveAccessibleName();
    }

    const labelledControls = Array.from(
      document.querySelectorAll<HTMLElement>(
        "a[aria-label], button[aria-label]",
      ),
    );
    for (const control of labelledControls) {
      const label =
        control.getAttribute("aria-label")?.toLocaleLowerCase() ?? "";
      const visibleText = (node: Node): string => {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
        if (
          node instanceof HTMLElement &&
          (node.getAttribute("aria-hidden") === "true" ||
            node.classList.contains("sr-only"))
        )
          return "";
        return Array.from(node.childNodes).map(visibleText).join(" ");
      };
      const text = visibleText(control)
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase();
      if (text)
        expect(
          label,
          `aria-label should contain the visible control text: ${text}`,
        ).toContain(text);
    }
  });

  it("submits only allowed request fields and renders request and plain-array history text literally", async () => {
    const user = userEvent.setup();
    const rawText = "<script>alert(1)</script> <img src=x onerror=alert(1)>";
    const expectedDate = futureDate(7);
    let submitted: unknown;
    const created = {
      ...requestItem,
      id: 702,
      description: rawText,
      expectedCompletionDate: expectedDate,
    };
    server.use(
      http.post(testApiUrl("/requests"), async ({ request }) => {
        submitted = await request.json();
        return HttpResponse.json(created, { status: 201 });
      }),
      http.get(testApiUrl("/requests/702"), () => HttpResponse.json(created)),
      http.get(testApiUrl("/requests/702/history"), () =>
        HttpResponse.json([
          {
            fromStatus: null,
            toStatus: "PENDING",
            changedBy: { id: 55, fullName: "Ravi Resident" },
            remarks: null,
            createdAt: "2026-11-02T08:00:00Z",
          },
        ]),
      ),
    );
    const { router } = renderApp("/resident/requests/new");
    expect(
      await screen.findByRole("heading", { name: "New request" }),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole("combobox", { name: /Service/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Expected completion date/)).toHaveAttribute(
      "min",
      getApplicationToday(),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /Service/ }),
      "8",
    );
    await user.type(
      screen.getByRole("textbox", { name: /Description/ }),
      rawText,
    );
    await user.type(
      screen.getByLabelText(/Expected completion date/),
      expectedDate,
    );
    await user.click(screen.getByRole("button", { name: "Submit request" }));
    expect(
      await screen.findByRole("heading", { name: "Request #702: Plumbing" }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/resident/requests/702");
    expect(submitted).toEqual({
      serviceId: 8,
      description: rawText,
      expectedCompletionDate: expectedDate,
    });
    expect(screen.getByText(rawText)).toBeInTheDocument();
    expect(
      document.querySelector(
        ".request-detail-card script, .request-detail-card img",
      ),
    ).toBeNull();
    expect(await screen.findByText("Created as Pending")).toBeInTheDocument();
    expect(screen.getByText("Changed by Ravi Resident")).toBeInTheDocument();
    expect(
      await screen.findByText("Request created successfully."),
    ).toBeInTheDocument();
  });

  it("keeps validated request list filters in the URL and falls back from invalid values", async () => {
    const seen: URLSearchParams[] = [];
    server.use(
      http.get(testApiUrl("/requests"), ({ request }) => {
        const params = new URL(request.url).searchParams;
        seen.push(params);
        return HttpResponse.json(
          emptyPage(
            [requestItem],
            1,
            Number(params.get("page") ?? 0),
            Number(params.get("size") ?? 20),
          ),
        );
      }),
    );
    const { router } = renderApp(
      "/resident/requests?status=PENDING&overdue=true&page=2&size=5&sort=requestDate,asc",
    );
    expect(
      await screen.findByRole("heading", { name: "My requests" }),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        seen.some(
          (params) =>
            params.get("page") === "2" &&
            params.get("size") === "5" &&
            params.get("status") === "PENDING" &&
            params.get("overdue") === "true" &&
            params.get("sort") === "requestDate,asc",
        ),
      ).toBe(true),
    );
    const actualUrl = new URLSearchParams(router.state.location.search);
    expect(actualUrl.get("status")).toBe("PENDING");
    expect(actualUrl.get("overdue")).toBe("true");
    expect(actualUrl.get("page")).toBe("2");
    expect(actualUrl.get("size")).toBe("5");
    expect(actualUrl.get("sort")).toBe("requestDate,asc");
    expect(document.querySelector(".request-mobile-cards")).toBeInTheDocument();
    expect(await screen.findAllByText("A tap is leaking")).toHaveLength(2);
  });

  it("does not request a non-numeric request id and presents a 404 without exposing the error code", async () => {
    let detailCalls = 0;
    server.use(
      http.get(testApiUrl("/requests/:id"), () => {
        detailCalls += 1;
        return HttpResponse.json(requestItem);
      }),
    );
    renderApp("/resident/requests/abc");
    expect(
      await screen.findByRole("heading", { name: "Request not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Back to my requests" }),
    ).toHaveAttribute("href", "/resident/requests");
    expect(detailCalls).toBe(0);
    expect(screen.queryByText("NOT_FOUND")).not.toBeInTheDocument();
  });

  it("shows unread state, optimistically marks one notification read, and supports mark all", async () => {
    const user = userEvent.setup();
    let readAll = false;
    let readOne = false;
    const notifications: NotificationItem[] = [
      {
        id: 9,
        requestId: 701,
        type: "REQUEST_STATUS_CHANGED",
        message: "<script>literal message</script>",
        read: false,
        createdAt: "2026-11-02T09:00:00Z",
        readAt: null,
      },
      {
        id: 10,
        requestId: 702,
        type: "REQUEST_STATUS_CHANGED",
        message: "Another request update",
        read: false,
        createdAt: "2026-11-02T08:00:00Z",
        readAt: null,
      },
    ];
    server.use(
      http.get(testApiUrl("/notifications"), () =>
        HttpResponse.json(
          emptyPage(
            notifications.map((item) => ({
              ...item,
              read: readAll || (item.id === 9 && readOne),
              readAt:
                readAll || (item.id === 9 && readOne)
                  ? "2026-11-02T10:00:00Z"
                  : null,
            })),
          ),
        ),
      ),
      http.get(testApiUrl("/notifications/unread-count"), () =>
        HttpResponse.json({ count: readAll ? 0 : readOne ? 1 : 2 }),
      ),
      http.patch(testApiUrl("/notifications/9/read"), () => {
        readOne = true;
        return HttpResponse.json({
          id: 9,
          read: true,
          readAt: "2026-11-02T10:00:00Z",
        });
      }),
      http.patch(testApiUrl("/notifications/read-all"), () => {
        readAll = true;
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp("/resident/notifications");
    expect(
      await screen.findByRole("heading", { name: "Notifications", level: 1 }),
    ).toBeInTheDocument();
    const notificationNav = document.querySelector(
      'nav[aria-label="Main navigation"] a[href="/resident/notifications"]',
    );
    expect(notificationNav).not.toBeNull();
    expect(notificationNav!).toHaveAccessibleName(/Notifications.*2.*unread/);
    expect(await screen.findAllByText("New")).toHaveLength(2);
    expect(
      document.querySelector(".notification-unread .sr-only")?.textContent,
    ).toBe("Unread: ");
    expect(
      screen.getByText("<script>literal message</script>"),
    ).toBeInTheDocument();
    expect(document.querySelector(".notification-card script")).toBeNull();
    await user.click(
      screen.getAllByRole("button", { name: "Mark as read" })[0]!,
    );
    await waitFor(() =>
      expect(
        screen.getAllByRole("button", { name: "Mark as read" }),
      ).toHaveLength(1),
    );
    await user.click(screen.getByRole("button", { name: "Mark all as read" }));
    expect(
      await screen.findByText("All notifications marked as read."),
    ).toBeInTheDocument();
  });

  it("shows the profile, rejects a reused password, maps current-password errors, and keeps success signed in", async () => {
    const user = userEvent.setup();
    let changeCalls = 0;
    server.use(
      http.post(testApiUrl("/auth/change-password"), () => {
        changeCalls += 1;
        if (changeCalls === 1)
          return HttpResponse.json(
            {
              timestamp: "2026-11-02T10:00:00Z",
              status: 400,
              code: "INVALID_CURRENT_PASSWORD",
              message: "Invalid current password",
              path: "/api/v1/auth/change-password",
              details: [],
            },
            { status: 400 },
          );
        return new HttpResponse(null, { status: 204 });
      }),
    );
    renderApp("/account");
    expect(
      await screen.findByRole("heading", { name: "Account" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ravi Resident")).toHaveLength(2);
    const flatNumberLabel = await screen.findByText("Flat number");
    expect(flatNumberLabel.nextElementSibling).toHaveTextContent("B-55");
    const current = screen.getByLabelText(/Current password/);
    const next = screen.getByLabelText(/New password/);
    const confirm = screen.getByLabelText(/Confirm new password/);
    await user.type(current, "CurrentPass123");
    await user.type(next, "CurrentPass123");
    await user.type(confirm, "CurrentPass123");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(
      await screen.findByText(
        "Choose a new password that differs from your current password.",
      ),
    ).toBeInTheDocument();
    expect(changeCalls).toBe(0);
    await user.clear(next);
    await user.clear(confirm);
    await user.type(next, "DifferentPass456");
    await user.type(confirm, "DifferentPass456");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(
      await screen.findByText("Current password is incorrect."),
    ).toBeInTheDocument();
    await user.clear(current);
    await user.type(current, "CurrentPass123");
    await user.click(screen.getByRole("button", { name: "Change password" }));
    expect(
      await screen.findByText(
        "Password changed successfully. You are still signed in.",
      ),
    ).toBeInTheDocument();
    await waitFor(() => expect(current).toHaveValue(""));
    expect(
      screen.getByRole("navigation", { name: "Main navigation" }),
    ).toBeInTheDocument();
  });
});
