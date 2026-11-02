import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { writeSession } from '@/features/auth/session';
import { server } from '@/test/server';
import { RequireAuth, RequireRole } from './guards';

function renderGuard(path: string, role?: 'USER' | 'ADMIN' | 'SUPER_ADMIN') {
  if (role) {
    const user = { id: 51, fullName: 'Test User', email: 'test@example.test', role, flatNumber: role === 'USER' ? 'A-51' : null, active: true };
    writeSession({ token: 'guard-test-token', expiresAt: '2099-01-01T00:00:00Z', user });
    server.use(http.get('http://localhost/api/v1/auth/me', () => HttpResponse.json(user)));
  }
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><AuthProvider><Routes>
    <Route path="/login" element={<h1>Sign in</h1>} />
    <Route element={<RequireAuth />}>
      <Route element={<RequireRole roles={['ADMIN', 'SUPER_ADMIN']} />}><Route path="/admin" element={<h1>Staff home</h1>} /></Route>
      <Route element={<RequireRole roles={['SUPER_ADMIN']} />}><Route path="/admin/admins" element={<h1>Admin management</h1>} /></Route>
      <Route path="/account" element={<h1>Account</h1>} />
    </Route>
  </Routes></AuthProvider></MemoryRouter></QueryClientProvider>);
}

describe('route guards', () => {
  it('sends anonymous visitors to login', async () => {
    renderGuard('/admin');
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });
  it('shows forbidden for a USER at a staff route', async () => {
    renderGuard('/admin', 'USER');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
  it('shows forbidden for an ADMIN at the super-admin route and allows SUPER_ADMIN', async () => {
    renderGuard('/admin/admins', 'ADMIN');
    expect(await screen.findByRole('heading', { name: 'Access denied' })).toBeInTheDocument();
  });
  it('allows a SUPER_ADMIN at the super-admin route', async () => {
    renderGuard('/admin/admins', 'SUPER_ADMIN');
    expect(await screen.findByRole('heading', { name: 'Admin management' })).toBeInTheDocument();
  });
});
