import { createMemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { App } from './App';
import { appRoutes } from './router';
import { server } from '@/test/server';
import { testApiUrl } from '@/test/api-url';
import { writeSession } from '@/features/auth/session';

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
  server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.json(user)));
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
    expect(await screen.findByRole('heading', { name: 'Resident dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/resident');
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

  it('keeps a newly authenticated session instead of clearing the empty startup snapshot', async () => {
    server.use(http.post(testApiUrl('/auth/login'), () => HttpResponse.json(loginResponse(60 * 60 * 1000))));
    const user = userEvent.setup();
    renderProductionApp('/login');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'login-resident@example.test');
    await user.type(screen.getByLabelText('Password *'), 'ValidPass123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Resident dashboard' })).toBeInTheDocument());
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
  });

  it('accepts the real UTC expiresAt shape and logs out a short-lived session on expiry', async () => {
    server.use(http.post(testApiUrl('/auth/login'), () => HttpResponse.json(loginResponse(2500))));
    const user = userEvent.setup();
    renderProductionApp('/login');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'login-resident@example.test');
    await user.type(screen.getByLabelText('Password *'), 'ValidPass123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Resident dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Your session has expired. Please sign in again.', {}, { timeout: 7000 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  }, 10_000);
});
