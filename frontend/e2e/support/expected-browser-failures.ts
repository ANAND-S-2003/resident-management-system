import { expect, type Page } from '@playwright/test';
import { redactDiagnosticText } from '../fixtures';

export interface ExpectedApiFailure {
  method: string;
  path: string;
  status: number;
  reason: string;
}

interface ApiResponseRecord { method: string; path: string; status: number }

/** Matches Chromium resource errors against the exact API failures a test deliberately causes. */
export function monitorExpectedBrowserFailures(page: Page) {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  const responses: ApiResponseRecord[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(redactDiagnosticText(message.text()));
  });
  page.on('pageerror', (error) => pageErrors.push(redactDiagnosticText(error.message)));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/v1/')) {
      responses.push({ method: response.request().method(), path: url.pathname, status: response.status() });
    }
  });

  return {
    assertExpectedFailures(expected: ExpectedApiFailure[]) {
      const context = expected.map(({ method, path, status, reason }) => `${method} ${path} ${status} (${reason})`).join('\n');
      const unexpectedConsoleErrors = consoleErrors.filter((message) => !message.startsWith('Failed to load resource:'));
      expect(unexpectedConsoleErrors, `Unexpected browser console errors. Expected API failures:\n${context}`).toEqual([]);
      expect(pageErrors, 'Uncaught browser page errors').toEqual([]);

      const expectedResponses = expected.map(({ method, path, status }) => `${method} ${path} ${status}`).sort();
      const actualFailures = responses.filter(({ status }) => status >= 400).map(({ method, path, status }) => `${method} ${path} ${status}`).sort();
      expect(actualFailures, `API failure responses did not match declared failures. Expected:\n${context}`).toEqual(expectedResponses);

      const expectedStatusCounts = countBy(expected.map(({ status }) => status));
      const consoleStatuses = consoleErrors.map((message) => {
        const match = /^Failed to load resource:.*status of (\d{3})\b/.exec(message);
        return match?.[1] ?? 'UNPARSEABLE';
      });
      expect(countBy(consoleStatuses), `Resource console-error status counts did not match expectations. Expected:\n${context}`).toEqual(expectedStatusCounts);
    },
  };
}

function countBy(values: Array<string | number>): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    const key = String(value);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}
