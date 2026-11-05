import { expect, test as base, type Request } from "@playwright/test";

interface RequestRecord {
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
      page.on("request", (request) => {
        const record: RequestRecord = {
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
      }
    },
    { auto: true },
  ],
});

export { expect };
