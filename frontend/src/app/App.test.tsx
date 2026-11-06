import { createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { App } from './App';
import { appRoutes } from './router';
import { server } from '@/test/server';
import { testApiUrl } from '@/test/api-url';
import { readSession, writeSession } from '@/features/auth/session';

type TestRole = 'USER' | 'ADMIN' | 'SUPER_ADMIN';
const expiry = () => new Date(Date.now() + 30 * 60 * 1000).toISOString();
function renderProductionApp(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] });
  const view = render(<App router={router} />);
  return { ...view, router };
}

function storeUser(role: TestRole) {
  const user = { id: 80, fullName: `Test ${role}`, email: `${role.toLowerCase()}@example.test`, role, flatNumber: role === 'USER' ? 'U-80' : null, active: true };
  writeSession({ token: `token-${role}`, expiresAt: expiry(), user });
  server.use(
    http.get(testApiUrl('/auth/me'), () => HttpResponse.json(user)),
    http.get(testApiUrl('/dashboard/summary'), () => HttpResponse.json({ byStatus: { PENDING: 0, IN_PROGRESS: 0, COMPLETED: 0, REJECTED: 0 }, overdueCount: 0, totalRequests: 0, activeResidents: 0, ...(role === 'SUPER_ADMIN' ? { activeAdmins: 0 } : {}) })),
  );
}

function loginResponse(expiresInMs: number) {
  return {
    accessToken: 'opaque-test-access-token',
    tokenType: 'Bearer',
    expiresAt: new Date(Date.now() + expiresInMs).toISOString().replace(/\.\d{3}Z$/, 'Z'),
    user: { id: 92, fullName: 'Login Resident', email: 'login-resident@example.test', role: 'USER', flatNumber: 'L-92' },
  };
}

describe('real application router composition', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => undefined); });
  afterEach(() => {
    expect(vi.mocked(console.error)).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it.each(['/','/resident'])('shows Login for an anonymous visit to %s', async (path) => {
    renderProductionApp(path);
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByLabelText('Password *')).toBeInTheDocument();
  });

  it('restores a USER session and renders the resident shell', async () => {
    storeUser('USER');
    const { router } = renderProductionApp('/resident');
    expect(await screen.findByRole('heading', { name: 'Welcome, Test' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/resident');
  });

  it('does not retry a not-found detail query', async () => {
    storeUser('USER');
    let attempts = 0;
    server.use(http.get(testApiUrl('/requests/123'), () => {
      attempts += 1;
      return HttpResponse.json({ timestamp: expiry(), status: 404, code: 'NOT_FOUND', message: 'missing', path: '/api/v1/requests/123', details: [] }, { status: 404 });
    }));
    renderProductionApp('/resident/requests/123');
    expect(await screen.findByRole('heading', { name: 'Request not found' })).toBeInTheDocument();
    expect(attempts).toBe(1);
  });

  it('renders the staff shell with Admins for SUPER_ADMIN and without it for ADMIN', async () => {
    storeUser('SUPER_ADMIN');
    const superAdminApp = renderProductionApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Admins' })).toBeInTheDocument();
    superAdminApp.unmount();

    storeUser('ADMIN');
    renderProductionApp('/admin');
    expect(await screen.findByRole('heading', { name: 'Admin dashboard' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Admins' })).not.toBeInTheDocument();
  });

  it('sends invalid and expired stored sessions to Login', async () => {
    writeSession({ token: 'invalid-token', expiresAt: expiry(), user: { id: 80, fullName: 'Test User', email: 'user@example.test', role: 'USER', flatNumber: 'U-80', active: true } });
    server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.json({ status: 401, code: 'UNAUTHENTICATED', message: 'Unauthorized' }, { status: 401 })));
    const invalidApp = renderProductionApp('/resident');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    invalidApp.unmount();

    writeSession({ token: 'expired-token', expiresAt: '2000-01-01T00:00:00Z', user: { id: 81, fullName: 'Expired User', email: 'expired@example.test', role: 'USER', flatNumber: 'U-81', active: true } });
    renderProductionApp('/resident');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('handles parallel rejected-session queries once and disables them after logout', async () => {
    const counts: Record<string, number> = { me: 0, requests: 0, unread: 0 };
    const unauthorized = (path: string) => ({ timestamp: expiry(), status: 401, code: 'UNAUTHENTICATED', message: 'Unauthorized', path, details: [] });
    writeSession({ token: 'rejected-token', expiresAt: expiry(), user: { id: 83, fullName: 'Rejected User', email: 'rejected@example.test', role: 'USER', flatNumber: 'R-83', active: true } });
    server.use(
      http.get(testApiUrl('/auth/me'), () => { counts.me += 1; return HttpResponse.json({ id: 83, fullName: 'Rejected User', email: 'rejected@example.test', role: 'USER', flatNumber: 'R-83', active: true }); }),
      http.get(testApiUrl('/requests'), () => { counts.requests += 1; return HttpResponse.json(unauthorized('/api/v1/requests'), { status: 401 }); }),
      http.get(testApiUrl('/notifications/unread-count'), () => { counts.unread += 1; return HttpResponse.json(unauthorized('/api/v1/notifications/unread-count'), { status: 401 }); }),
    );
    const { router } = renderProductionApp('/resident');
    await waitFor(() => expect(router.state.location.pathname).toBe('/login'));
    expect(await screen.findByText('Your session has expired. Please sign in again.')).toBeInTheDocument();
    expect(readSession()).toBeNull();
    expect(counts.me).toBe(1);
    expect(counts.requests).toBeGreaterThan(0);
    expect(counts.unread).toBeGreaterThan(0);
    const after401 = { ...counts };
    vi.useFakeTimers();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
      window.dispatchEvent(new Event('focus'));
      window.dispatchEvent(new Event('online'));
    });
    await Promise.resolve();
    expect(counts).toEqual(after401);
    vi.useRealTimers();
  });

  it('keeps a newly authenticated session instead of clearing the empty startup snapshot', async () => {
    const authorizationHeaders: string[] = [];
    server.use(
      http.post(testApiUrl('/auth/login'), () => HttpResponse.json(loginResponse(60 * 60 * 1000))),
      http.get(testApiUrl('/requests'), ({ request }) => {
        authorizationHeaders.push(request.headers.get('Authorization') ?? '');
        return HttpResponse.json({ content: [], page: 0, size: 1, totalElements: 0, totalPages: 0 });
      }),
      http.get(testApiUrl('/notifications/unread-count'), ({ request }) => {
        authorizationHeaders.push(request.headers.get('Authorization') ?? '');
        return HttpResponse.json({ count: 0 });
      }),
    );
    const user = userEvent.setup();
    renderProductionApp('/login');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /Email/ }), 'login-resident@example.test');
    await user.type(screen.getByLabelText('Password *'), 'ValidPass123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Welcome, Login' })).toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    await waitFor(() => expect(authorizationHeaders).toHaveLength(7));
    expect(authorizationHeaders).toEqual(Array(7).fill('Bearer opaque-test-access-token'));
  });

  it('accepts the real UTC expiresAt shape and logs out a short-lived session on expiry', async () => {
    server.use(http.post(testApiUrl('/auth/login'), () => HttpResponse.json(loginResponse(2500))));
    const user = userEvent.setup();
    renderProductionApp('/login');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: /Email/ }), 'login-resident@example.test');
    await user.type(screen.getByLabelText('Password *'), 'ValidPass123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Welcome, Login' })).toBeInTheDocument();
    expect(await screen.findByText('Your session has expired. Please sign in again.', {}, { timeout: 7000 })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Sign in' }, { timeout: 3000 })).toBeInTheDocument();
  }, 10_000);
});
