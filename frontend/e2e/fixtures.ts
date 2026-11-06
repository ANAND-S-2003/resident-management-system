import { expect, test as base, type Request } from "@playwright/test";

interface RequestRecord {
  sequence: number | null;
  navigation: number;
  pageUrl: string;
  authorizationPresent: boolean;
  method: string;
  url: string;
  status: number | null;
  failure?: string;
}
interface Diagnostics {
  requests: RequestRecord[];
  console: string[];
  pageErrors: string[];
}

function safeUrl(rawUrl: string): string {
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

export function redactDiagnosticText(value: string): string {
  let safe = value;
  const configuredPassword = process.env.RMS_SUPERADMIN_PASSWORD;
  if (configuredPassword)
    safe = safe.split(configuredPassword).join("[REDACTED]");
  return safe
    .replace(/Bearer\s+[^\s"']+/gi, "Bearer [REDACTED]")
    .replace(
      /("?(?:password|accessToken|token|secret)"?\s*[:=]\s*"?)[^,}\s"]+/gi,
      "$1[REDACTED]",
    );
}

export const test = base.extend<{ diagnostics: void }>({
  diagnostics: [
    async ({ page }, use, testInfo) => {
      const diagnostics: Diagnostics = {
        requests: [],
        console: [],
        pageErrors: [],
      };
      const byRequest = new Map<Request, RequestRecord>();
      let navigation = 0;
      let apiSequence = 0;
      page.on("framenavigated", (frame) => {
        if (frame === page.mainFrame()) navigation += 1;
      });
      page.on("request", (request) => {
        const requestUrl = new URL(request.url());
        const isApiRequest = requestUrl.pathname.startsWith("/api/v1/");
        const record: RequestRecord = {
          sequence: isApiRequest ? ++apiSequence : null,
          navigation,
          pageUrl: safeUrl(page.url()),
          authorizationPresent: Boolean(request.headers().authorization),
          method: request.method(),
          url: safeUrl(request.url()),
          status: null,
        };
        diagnostics.requests.push(record);
        byRequest.set(request, record);
      });
      page.on("response", (response) => {
        const record = byRequest.get(response.request());
        if (record) record.status = response.status();
      });
      page.on("requestfailed", (request) => {
        const record = byRequest.get(request);
        if (record)
          record.failure = redactDiagnosticText(
            request.failure()?.errorText ?? "request failed",
          );
      });
      page.on("console", (message) =>
        diagnostics.console.push(
          `${message.type()}: ${redactDiagnosticText(message.text())}`,
        ),
      );
      page.on("pageerror", (error) =>
        diagnostics.pageErrors.push(redactDiagnosticText(error.message)),
      );

      await use();

      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach("browser-diagnostics.json", {
          body: JSON.stringify(diagnostics, null, 2),
          contentType: "application/json",
        });
        const apiRequests = diagnostics.requests.filter(
          (record) => record.sequence !== null,
        );
        const apiTable = [
          "sequence\tnavigation\tpage URL\tmethod/path\tstatus\tAuthorization header present",
          ...apiRequests.map(
            (record) =>
              `${record.sequence}\t${record.navigation}\t${record.pageUrl}\t${record.method} ${record.url}\t${record.status ?? "pending"}\t${record.authorizationPresent}`,
          ),
        ].join("\n");
        await testInfo.attach("api-request-navigation-table.txt", {
          body: apiTable,
          contentType: "text/plain",
        });
      }
    },
    { auto: true },
  ],
});

export { expect };
