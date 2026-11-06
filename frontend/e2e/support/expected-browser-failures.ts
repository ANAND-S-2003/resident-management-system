import { expect, type Page, type Request } from "@playwright/test";
import { redactDiagnosticText } from "../fixtures";

export interface ExpectedApiFailure {
  method: string;
  path: string;
  status: number;
  reason: string;
}

interface ApiResponseRecord {
  sequence: number;
  navigation: number;
  pageUrl: string;
  authorizationPresent: boolean;
  method: string;
  path: string;
  status: number | null;
}

/** Matches Chromium resource errors against the exact API failures a test deliberately causes. */
export function monitorExpectedBrowserFailures(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const responses: ApiResponseRecord[] = [];
  const byRequest = new Map<Request, ApiResponseRecord>();
  let navigation = 0;
  let sequence = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigation += 1;
  });
  page.on("console", (message) => {
    if (message.type() === "error")
      consoleErrors.push(redactDiagnosticText(message.text()));
  });
  page.on("pageerror", (error) =>
    pageErrors.push(redactDiagnosticText(error.message)),
  );
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/v1/")) return;
    const record: ApiResponseRecord = {
      sequence: ++sequence,
      navigation,
      pageUrl: safePageUrl(page.url()),
      authorizationPresent: Boolean(request.headers().authorization),
      method: request.method(),
      path: url.pathname,
      status: null,
    };
    responses.push(record);
    byRequest.set(request, record);
  });
  page.on("response", (response) => {
    const record = byRequest.get(response.request());
    if (record) record.status = response.status();
  });

  const diagnosticTable = () =>
    responses
      .map(
        ({
          sequence: seq,
          navigation: nav,
          pageUrl,
          authorizationPresent,
          method,
          path,
          status,
        }) =>
          `${seq}\t${nav}\t${pageUrl}\t${method} ${path}\t${status ?? "pending"}\tAuthorization: ${authorizationPresent}`,
      )
      .join("\n") || "(no API requests recorded)";
  const failureContext = (context: string) =>
    `${context}\nAPI request diagnostics (sequence, navigation, page URL, request, status, auth header present):\n${diagnosticTable()}`;

  return {
    assertExpectedFailures(expected: ExpectedApiFailure[]) {
      const context = expected
        .map(
          ({ method, path, status, reason }) =>
            `${method} ${path} ${status} (${reason})`,
        )
        .join("\n");
      const unexpectedConsoleErrors = consoleErrors.filter(
        (message) => !message.startsWith("Failed to load resource:"),
      );
      expect(
        unexpectedConsoleErrors,
        failureContext(
          `Unexpected browser console errors. Expected API failures:\n${context}`,
        ),
      ).toEqual([]);
      expect(
        pageErrors,
        failureContext("Uncaught browser page errors"),
      ).toEqual([]);

      const expectedResponses = expected
        .map(({ method, path, status }) => `${method} ${path} ${status}`)
        .sort();
      const actualFailures = responses
        .filter(({ status }) => status !== null && status >= 400)
        .map(({ method, path, status }) => `${method} ${path} ${status}`)
        .sort();
      expect(
        actualFailures,
        failureContext(
          `API failure responses did not match declared failures. Expected:\n${context}`,
        ),
      ).toEqual(expectedResponses);

      const expectedStatusCounts = countBy(
        expected.map(({ status }) => status),
      );
      const consoleStatuses = consoleErrors.map((message) => {
        const match = /^Failed to load resource:.*status of (\d{3})\b/.exec(
          message,
        );
        return match?.[1] ?? "UNPARSEABLE";
      });
      expect(
        countBy(consoleStatuses),
        failureContext(
          `Resource console-error status counts did not match expectations. Expected:\n${context}`,
        ),
      ).toEqual(expectedStatusCounts);
    },
  };
}

function safePageUrl(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    for (const key of [...url.searchParams.keys()]) {
      if (/password|token|secret|authorization/i.test(key))
        url.searchParams.set(key, "[REDACTED]");
    }
    return `${url.origin}${url.pathname}${url.search}`;
  } catch {
    return "[invalid URL]";
  }
}

function countBy(values: Array<string | number>): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = String(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
