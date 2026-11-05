import { createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import axe from 'axe-core';
import { http, HttpResponse } from 'msw';
import { App } from '@/app/App';
import { appRoutes } from '@/app/router';
import { clearStoredSession, writeSession } from '@/features/auth/session';
import type { DashboardSummary, RequestHistoryEntry, ServiceRequest } from '@/lib/api/types';
import { testApiUrl } from '@/test/api-url';
import { server } from '@/test/server';

const profile = { id: 909, fullName: 'Arun Admin', email: 'arun@example.test', role: 'ADMIN' as const, flatNumber: null, active: true };
const superProfile = { ...profile, id: 910, fullName: 'Sara Super', role: 'SUPER_ADMIN' as const };
const emptyPage = <T,>(content: T[] = [], page = 0, size = 20, totalElements = content.length) => ({ content, page, size, totalElements, totalPages: Math.ceil(totalElements / size) });
const requestTemplate: ServiceRequest = {
  id: 9001, resident: { id: 901, fullName: 'Asha Resident' }, flatNumber: 'R-901', service: { id: 4, name: 'Plumbing' },
  description: 'A leaking tap', requestDate: '2026-11-02', expectedCompletionDate: '2026-11-12', status: 'PENDING', adminRemarks: null,
  version: 0, overdue: false, createdAt: '2026-11-02T08:00:00Z', updatedAt: '2026-11-02T08:00:00Z',
};
const summary: DashboardSummary = { byStatus: { PENDING: 4, IN_PROGRESS: 3, COMPLETED: 8, REJECTED: 2 }, overdueCount: 1, totalRequests: 17, activeResidents: 7 };
const historyRows: RequestHistoryEntry[] = [{ fromStatus: null, toStatus: 'PENDING', changedBy: { id: 901, fullName: 'Asha Resident' }, remarks: null, createdAt: '2026-11-02T08:00:00Z' }];
let consoleError: ReturnType<typeof vi.spyOn>;

function renderStaff(path: string, role: 'ADMIN' | 'SUPER_ADMIN' | 'USER' = 'ADMIN') {
  const user = role === 'SUPER_ADMIN' ? superProfile : role === 'USER' ? { id: 911, fullName: 'Uma User', email: 'uma@example.test', role, flatNumber: 'U-911', active: true } : profile;
  writeSession({ token: `test-${role}`, expiresAt: '2099-12-31T23:59:59Z', user });
  server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.json(user)));
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  return { ...render(<App router={router} />), router };
}

function installHandlers() {
  let requestRow = requestTemplate;
  server.use(
    http.get(testApiUrl('/dashboard/summary'), () => HttpResponse.json(summary)),
    http.get(testApiUrl('/requests'), ({ request }) => {
      const query = new URL(request.url).searchParams;
      const rows = query.get('status') === 'PENDING' || query.get('overdue') === 'true' ? [requestRow] : [requestRow];
      return HttpResponse.json(emptyPage(rows.slice(0, Number(query.get('size') ?? 20)), Number(query.get('page') ?? 0), Number(query.get('size') ?? 20), rows.length));
    }),
    http.get(testApiUrl('/requests/:id/history'), () => HttpResponse.json(historyRows)),
    http.get(testApiUrl('/requests/:id'), () => HttpResponse.json(requestRow)),
    http.patch(testApiUrl('/requests/:id'), async ({ request }) => {
      const body = await request.json() as { status?: ServiceRequest['status']; adminRemarks?: string };
      requestRow = { ...requestRow, status: body.status ?? requestRow.status, adminRemarks: body.adminRemarks ?? requestRow.adminRemarks, updatedAt: '2026-11-03T09:00:00Z' };
      return HttpResponse.json(requestRow);
    }),
    http.get(testApiUrl('/notifications/unread-count'), () => HttpResponse.json({ count: 0 })),
  );
}

describe('staff screens in the production app composition', () => {
  beforeEach(() => { server.resetHandlers(); installHandlers(); consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => { cleanup(); expect(consoleError).not.toHaveBeenCalled(); vi.restoreAllMocks(); clearStoredSession(); });

  it('shows dashboard counts and links, omitting activeAdmins for ADMIN', async () => {
    renderStaff('/admin');
    expect(await screen.findByRole('link', { name: /Pending requests/ })).toBeVisible();
    expect(screen.getByText('17')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Active residents' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Active admins' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pending requests/ })).toHaveAttribute('href', '/admin/requests?status=PENDING');
    expect(screen.getByRole('link', { name: /Overdue requests/ })).toHaveAttribute('href', '/admin/requests?overdue=true');
    expect(document.querySelector('a[href="/admin/requests/9001"]')).toBeInTheDocument();
  });

  it('renders active admin dashboard total only for SUPER_ADMIN', async () => {
    server.use(http.get(testApiUrl('/dashboard/summary'), () => HttpResponse.json({ ...summary, activeAdmins: 2 })));
    renderStaff('/admin', 'SUPER_ADMIN');
    expect(await screen.findByRole('heading', { name: 'Active admins' })).toBeVisible();
    expect(within(screen.getByRole('heading', { name: 'Active admins' }).parentElement!.parentElement!).getByText('2')).toBeVisible();
  });

  it('shows attention empty states when there are no pending or overdue requests', async () => {
    server.use(http.get(testApiUrl('/requests'), ({ request }) => {
      const query = new URL(request.url).searchParams;
      return HttpResponse.json(emptyPage([], Number(query.get('page') ?? 0), Number(query.get('size') ?? 20), 0));
    }));
    renderStaff('/admin');
    expect(await screen.findByRole('heading', { name: 'Nothing is waiting' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Nothing is overdue' })).toBeVisible();
  });

  it('keeps filters in URL, debounces resident search, and renders narrow-card markup', async () => {
    const user = userEvent.setup();
    let seenSearch: string | null = null;
    server.use(http.get(testApiUrl('/requests'), ({ request }) => {
      const params = new URL(request.url).searchParams;
      seenSearch = params.get('q');
      return HttpResponse.json(emptyPage([requestTemplate], Number(params.get('page') ?? 0), Number(params.get('size') ?? 20), 1));
    }));
    const { router } = renderStaff('/admin/requests?status=PENDING&overdue=true&size=10&sort=requestDate%2Casc');
    expect(await screen.findByRole('heading', { name: 'Requests' })).toBeVisible();
    expect(await screen.findByText('Asha Resident')).toBeVisible();
    expect(document.querySelector('.staff-request-mobile-cards')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Search residents' }), '  Asha  ');
    await waitFor(() => expect(seenSearch).toBe('Asha'), { timeout: 1500 });
    await waitFor(() => expect(router.state.location.search).toContain('q=Asha'));
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Search residents' })).toHaveValue('Asha'));
    expect(router.state.location.search).toContain('status=PENDING');
    expect(router.state.location.search).toContain('overdue=true');
  });

  it('distinguishes a filtered empty result from a community with no requests and can clear filters', async () => {
    const user = userEvent.setup();
    let cleared = false;
    server.use(http.get(testApiUrl('/requests'), ({ request }) => {
      const query = new URL(request.url).searchParams;
      if (query.get('status') === 'REJECTED') return HttpResponse.json(emptyPage([], 0, Number(query.get('size') ?? 20), 0));
      if (query.get('size') === '1') return HttpResponse.json(emptyPage([requestTemplate], 0, 1, 1));
      cleared = true;
      return HttpResponse.json(emptyPage([requestTemplate], 0, Number(query.get('size') ?? 20), 1));
    }));
    const { router } = renderStaff('/admin/requests?status=REJECTED');
    expect(await screen.findByRole('heading', { name: 'No requests match these filters' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(cleared).toBe(true));
    expect(router.state.location.search).toBe('');
    expect(await screen.findByText('Asha Resident')).toBeVisible();
  });

  it('offers the staff no-requests empty state when the collection is empty', async () => {
    server.use(http.get(testApiUrl('/requests'), ({ request }) => {
      const query = new URL(request.url).searchParams;
      return HttpResponse.json(emptyPage([], Number(query.get('page') ?? 0), Number(query.get('size') ?? 20), 0));
    }));
    renderStaff('/admin/requests');
    expect(await screen.findByRole('heading', { name: 'No requests yet' })).toBeVisible();
  });

  it('starts work with exactly the status payload and refreshes detail and history', async () => {
    const user = userEvent.setup();
    let received: unknown;
    let historyCalls = 0;
    let currentStatus: ServiceRequest['status'] = 'PENDING';
    server.use(
      http.patch(testApiUrl('/requests/:id'), async ({ request }) => { received = await request.json(); currentStatus = 'IN_PROGRESS'; return HttpResponse.json({ ...requestTemplate, status: currentStatus }); }),
      http.get(testApiUrl('/requests/:id/history'), () => { historyCalls += 1; return HttpResponse.json([...historyRows, { fromStatus: 'PENDING', toStatus: 'IN_PROGRESS', changedBy: { id: 909, fullName: profile.fullName }, remarks: null, createdAt: '2026-11-03T09:00:00Z' }]); }),
      http.get(testApiUrl('/requests/:id'), () => HttpResponse.json({ ...requestTemplate, status: currentStatus })),
    );
    renderStaff('/admin/requests/9001');
    expect(await screen.findByRole('heading', { name: 'Request #9001: Plumbing' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Start work' }));
    await waitFor(() => expect(received).toEqual({ status: 'IN_PROGRESS' }));
    expect(await screen.findByText('From Pending to In progress')).toBeVisible();
    expect(await within(screen.getByTestId('toast-region')).findByText('Request #9001 is now In progress')).toBeVisible();
    expect(historyCalls).toBeGreaterThan(1);
  });

  it('requires rejection remarks, maps response field errors, and closes requests after rejection', async () => {
    const user = userEvent.setup();
    let received: unknown;
    let current: ServiceRequest = requestTemplate;
    server.use(http.get(testApiUrl('/requests/:id'), () => HttpResponse.json(current)), http.patch(testApiUrl('/requests/:id'), async ({ request }) => {
      received = await request.json();
      if (!(received as { adminRemarks?: string }).adminRemarks) return HttpResponse.json({ timestamp: '2026-11-03T00:00:00Z', status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', path: '/api/v1/requests/9001', details: [{ field: 'adminRemarks', message: 'Required' }] }, { status: 400 });
      current = { ...current, status: 'REJECTED', adminRemarks: (received as { adminRemarks: string }).adminRemarks };
      return HttpResponse.json(current);
    }));
    renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect(await screen.findByText('Admin remarks are required when rejecting a request.')).toBeVisible();
    await user.type(screen.getByRole('textbox', { name: 'Admin remarks' }), 'Resident requested cancellation');
    await user.click(screen.getByRole('button', { name: 'Confirm reject' }));
    await waitFor(() => expect(received).toEqual({ status: 'REJECTED', adminRemarks: 'Resident requested cancellation' }));
    expect(await screen.findByText('This request is closed.')).toBeVisible();
  });

  it('maps a backend 400 adminRemarks validation detail onto the dialog field', async () => {
    const user = userEvent.setup();
    server.use(http.patch(testApiUrl('/requests/:id'), () => HttpResponse.json({ timestamp: '2026-11-03T00:00:00Z', status: 400, code: 'VALIDATION_ERROR', message: 'Invalid input', path: '/api/v1/requests/9001', details: [{ field: 'adminRemarks', message: 'Remarks need more detail.' }] }, { status: 400 })));
    renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    await user.click(screen.getByRole('button', { name: 'Reject' }));
    await user.type(screen.getByRole('textbox', { name: 'Admin remarks' }), 'Please cancel');
    await user.click(screen.getByRole('button', { name: 'Confirm reject' }));
    expect(await screen.findByText('Remarks need more detail.')).toBeVisible();
    expect(screen.getByRole('textbox', { name: 'Admin remarks' })).toHaveAttribute('aria-invalid', 'true');
  });

  it('confirms completion, sends only COMPLETED, and exposes no actions after success', async () => {
    const user = userEvent.setup();
    let current: ServiceRequest = { ...requestTemplate, status: 'IN_PROGRESS' };
    let received: unknown;
    server.use(
      http.get(testApiUrl('/requests/:id'), () => HttpResponse.json(current)),
      http.patch(testApiUrl('/requests/:id'), async ({ request }) => { received = await request.json(); current = { ...current, status: 'COMPLETED' }; return HttpResponse.json(current); }),
    );
    renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    await user.click(screen.getByRole('button', { name: 'Mark completed' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Confirm that request #9001 will be marked completed.');
    await user.click(screen.getByRole('button', { name: 'Confirm mark completed' }));
    await waitFor(() => expect(received).toEqual({ status: 'COMPLETED' }));
    expect(await screen.findByText('This request is closed.')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Mark completed' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject' })).not.toBeInTheDocument();
  });

  it('prevents a second status submission while the first request is pending', async () => {
    const user = userEvent.setup();
    let patchCount = 0;
    let updated = false;
    server.use(
      http.get(testApiUrl('/requests/:id'), () => HttpResponse.json({ ...requestTemplate, status: updated ? 'IN_PROGRESS' : 'PENDING' })),
      http.get(testApiUrl('/requests/:id/history'), () => HttpResponse.json(updated ? [...historyRows, { fromStatus: 'PENDING', toStatus: 'IN_PROGRESS', changedBy: { id: 909, fullName: profile.fullName }, remarks: null, createdAt: '2026-11-03T09:00:00Z' }] : historyRows)),
      http.patch(testApiUrl('/requests/:id'), async () => {
      patchCount += 1;
      await new Promise((resolve) => window.setTimeout(resolve, 250));
      updated = true;
      return HttpResponse.json({ ...requestTemplate, status: 'IN_PROGRESS' });
      }),
    );
    renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    const start = screen.getByRole('button', { name: 'Start work' });
    await user.click(start);
    await waitFor(() => expect(start).toBeDisabled());
    await user.click(start);
    expect(patchCount).toBe(1);
    expect(await screen.findByText('From Pending to In progress')).toBeVisible();
  });

  it('opens the action dialog focused and restores focus to Reject after Escape', async () => {
    const user = userEvent.setup();
    renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    const reject = screen.getByRole('button', { name: 'Reject' });
    await user.click(reject);
    expect(screen.getByRole('textbox', { name: 'Admin remarks' })).toHaveFocus();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(reject).toHaveFocus());
  });

  it.each([
    { status: 403, code: 'FORBIDDEN', message: 'You do not have permission to view this information.' },
    { status: 429, code: 'TOO_MANY_REQUESTS', message: 'Please wait 12 seconds before trying again.' },
  ])('shows a friendly message for status update HTTP $status', async ({ status, code, message }) => {
    const user = userEvent.setup();
    server.use(http.patch(testApiUrl('/requests/:id'), () => HttpResponse.json({ timestamp: '2026-11-03T00:00:00Z', status, code, message: 'server text', path: '/api/v1/requests/9001', details: [] }, { status, headers: status === 429 ? { 'Retry-After': '12' } : undefined })));
    renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    await user.click(screen.getByRole('button', { name: 'Start work' }));
    expect(await screen.findByText(message)).toBeVisible();
  });

  it('shows a friendly network message when a status update cannot reach the server', async () => {
    const user = userEvent.setup();
    server.use(http.patch(testApiUrl('/requests/:id'), () => HttpResponse.error()));
    renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    await user.click(screen.getByRole('button', { name: 'Start work' }));
    expect(await screen.findByText('Unable to connect. Check your connection and try again.')).toBeVisible();
  });

  it('refreshes after a status conflict and sends remarks-only payloads without status', async () => {
    const user = userEvent.setup();
    let patchCount = 0;
    let detailCount = 0;
    let received: unknown;
    server.use(
      http.patch(testApiUrl('/requests/:id'), async ({ request }) => {
        received = await request.json(); patchCount += 1;
        return HttpResponse.json({ timestamp: '2026-11-03T00:00:00Z', status: 409, code: 'CONCURRENT_MODIFICATION', message: 'conflict', path: '/api/v1/requests/9001', details: [] }, { status: 409 });
      }),
      http.get(testApiUrl('/requests/:id'), () => { detailCount += 1; return HttpResponse.json(requestTemplate); }),
    );
    renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    await user.click(screen.getByRole('button', { name: 'Start work' }));
    expect(await screen.findByText('This request was just updated by someone else. We loaded the latest version.')).toBeVisible();
    expect(detailCount).toBeGreaterThan(1);
    const remarksBox = screen.getByRole('textbox', { name: 'Admin remarks' });
    await user.type(remarksBox, 'A note');
    await user.click(screen.getByRole('button', { name: 'Save remarks' }));
    await waitFor(() => expect(received).toEqual({ adminRemarks: 'A note' }));
    expect(patchCount).toBe(2);
  });

  it('does not call the API for an invalid request ID and denies USER access to the staff routes', async () => {
    let detailCalls = 0;
    server.use(http.get(testApiUrl('/requests/:id'), () => { detailCalls += 1; return HttpResponse.json(requestTemplate); }));
    const invalidApp = renderStaff('/admin/requests/not-a-number');
    expect(await screen.findByRole('heading', { name: 'Request not found' })).toBeVisible();
    expect(detailCalls).toBe(0);
    invalidApp.unmount();
    clearStoredSession();
    const userApp = renderStaff('/admin/requests', 'USER');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeVisible();
    userApp.unmount();
  });

  it('shows the same friendly not-found screen for a missing backend request', async () => {
    server.use(http.get(testApiUrl('/requests/:id'), () => HttpResponse.json({ timestamp: '2026-11-03T00:00:00Z', status: 404, code: 'NOT_FOUND', message: 'missing', path: '/api/v1/requests/9001', details: [] }, { status: 404 })));
    renderStaff('/admin/requests/9001');
    expect(await screen.findByRole('heading', { name: 'Request not found' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to requests' })).toHaveAttribute('href', '/admin/requests');
  });

  it('renders user-provided descriptions and history remarks as literal text', async () => {
    const raw = '<img src=x onerror=alert(1)> <script>alert(1)</script>';
    server.use(http.get(testApiUrl('/requests/:id'), () => HttpResponse.json({ ...requestTemplate, description: raw, adminRemarks: raw })), http.get(testApiUrl('/requests/:id/history'), () => HttpResponse.json([{ ...historyRows[0], remarks: raw }])));
    renderStaff('/admin/requests/9001');
    expect(await screen.findByRole('heading', { name: 'Request #9001: Plumbing' })).toBeVisible();
    expect(screen.getAllByText(raw).length).toBeGreaterThanOrEqual(2);
    expect(document.querySelector('img')).toBeNull();
    expect(document.querySelector('script')).toBeNull();
  });

  it.each(['/admin', '/admin/requests', '/admin/requests/9001'])('passes the loaded route accessibility scan: %s', async (path) => {
    const { container } = renderStaff(path);
    if (path === '/admin') await screen.findByRole('link', { name: /Pending requests/ });
    else if (path.endsWith('9001')) { await screen.findByRole('heading', { name: 'Request #9001: Plumbing' }); await screen.findByText('Created as Pending'); }
    else { await screen.findByRole('heading', { name: 'Requests' }); await screen.findByText('Asha Resident'); }
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });

  it('passes an accessibility scan with the completion confirmation dialog open', async () => {
    const user = userEvent.setup();
    server.use(http.get(testApiUrl('/requests/:id'), () => HttpResponse.json({ ...requestTemplate, status: 'IN_PROGRESS' })));
    const { container } = renderStaff('/admin/requests/9001');
    await screen.findByRole('heading', { name: 'Request #9001: Plumbing' });
    await screen.findByText('Created as Pending');
    await user.click(screen.getByRole('button', { name: 'Mark completed' }));
    await screen.findByRole('dialog', { name: 'Mark completed request #9001' });
    const results = await axe.run(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations).toEqual([]);
  });
});
