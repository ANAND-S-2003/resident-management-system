import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import axe from 'axe-core';
import { beforeEach, describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { testApiUrl } from '@/test/api-url';
import { AuthProvider } from './AuthProvider';
import { LoginPage } from './LoginPage';
import { RegisterPage } from './RegisterPage';
import { AppShell } from '@/app/layout';
import { ComingSoon } from '@/app/pages';
import { writeSession } from './session';

function renderAuth(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter><AuthProvider><Routes><Route path="*" element={<>{node}<LocationProbe /></>} /></Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
}
function LocationProbe() { return <output aria-label="Current path">{useLocation().pathname}</output>; }
const loginResponse = { accessToken: 'test-token', tokenType: 'Bearer', expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), user: { id: 12, fullName: 'Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-12' } };

describe('authentication pages', () => {
  beforeEach(() => { server.resetHandlers(); });
  it('validates login fields and maps invalid credentials without exposing the password', async () => {
    const user = userEvent.setup();
    server.use(http.post(testApiUrl('/auth/login'), () => HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect', details: [] }, { status: 401 })));
    renderAuth(<LoginPage />);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Enter a valid email address.')).toBeInTheDocument();
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'resident@example.test');
    await user.type(screen.getByLabelText('Password *'), 'NeverRenderThis123');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument();
    expect(document.body.textContent).not.toContain('NeverRenderThis123');
  });
  it('registers and signs in automatically', async () => {
    const user = userEvent.setup();
    const called: string[] = [];
    server.use(
      http.post(testApiUrl('/auth/register'), () => { called.push('register'); return HttpResponse.json({ id: 12, fullName: 'Resident Name', email: 'resident@example.test', role: 'USER', flatNumber: 'A-12', active: true }, { status: 201 }); }),
      http.post(testApiUrl('/auth/login'), () => { called.push('login'); return HttpResponse.json(loginResponse); }),
    );
    renderAuth(<RegisterPage />);
    await user.type(screen.getByRole('textbox', { name: 'Full name' }), 'Resident Name');
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'resident@example.test');
    await user.type(screen.getByRole('textbox', { name: 'Flat number' }), 'A-12');
    await user.type(screen.getByLabelText('Password *'), 'GoodPass123');
    await user.type(screen.getByLabelText('Confirm password *'), 'GoodPass123');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(called).toEqual(['register', 'login']));
    expect(screen.getByLabelText('Current path')).toHaveTextContent('/resident');
    expect(document.body.textContent).not.toContain('GoodPass123');
  });
  it('login view passes axe accessibility checks', async () => {
    const { container } = renderAuth(<LoginPage />);
    const results = await axe.run(container);
    expect(results.violations).toEqual([]);
  });
  it('register view and authenticated app shell pass axe accessibility checks', async () => {
    const registerRender = renderAuth(<RegisterPage />);
    expect((await axe.run(registerRender.container)).violations).toEqual([]);
    registerRender.unmount();
    writeSession({ token: 'stored-token', expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), user: { id: 12, fullName: 'Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-12', active: true } });
    server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.json({ id: 12, fullName: 'Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-12', active: true })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const shell = render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/resident']}><AuthProvider><Routes><Route element={<AppShell />}><Route path="/resident" element={<ComingSoon title="Resident dashboard" />} /></Route></Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Resident dashboard' });
    expect((await axe.run(shell.container)).violations).toEqual([]);
  });
  it('mobile navigation traps focus and closes with Escape', async () => {
    const user = userEvent.setup();
    writeSession({ token: 'stored-token', expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(), user: { id: 12, fullName: 'Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-12', active: true } });
    server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.json({ id: 12, fullName: 'Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-12', active: true })));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/resident']}><AuthProvider><Routes><Route element={<AppShell />}><Route path="/resident" element={<ComingSoon title="Resident dashboard" />} /></Route></Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
    await screen.findByRole('heading', { name: 'Resident dashboard' });
    const menuButton = screen.getByRole('button', { name: /Open navigation menu/ });
    await user.click(menuButton);
    const closeButton = screen.getByRole('button', { name: /Close navigation menu/ });
    expect(closeButton).toHaveFocus();
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
    expect(screen.queryByRole('main')).not.toBeInTheDocument();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    expect(within(screen.getByRole('dialog', { name: 'Mobile navigation' })).getByRole('link', { name: 'Account' })).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Mobile navigation' })).not.toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(menuButton).toHaveFocus();
  });
});
