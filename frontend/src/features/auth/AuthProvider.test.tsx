import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { testApiUrl } from '@/test/api-url';
import { readSession, writeSession } from './session';
import { AuthProvider, useAuth } from './AuthProvider';
import { useRequests } from '@/features/requests/hooks';

const userDto = { id: 9, fullName: 'Session User', email: 'session@example.test', role: 'USER' as const, flatNumber: 'A-9', active: true };
const futureExpiry = () => new Date(Date.now() + 30 * 60 * 1000).toISOString();
const session = { token: 'provider-test-token', expiresAt: futureExpiry(), user: userDto };

function Probe({ watchRequests = false }: { watchRequests?: boolean }) {
  const auth = useAuth();
  const queryClient = useQueryClient();
  return <div><span>{auth.status}</span><span>{auth.user?.fullName}</span>{watchRequests && auth.status === 'authenticated' && <RequestsProbe />}<button onClick={() => auth.logout()}>Log out</button><button onClick={() => queryClient.setQueryData<string>(['private'], 'cached')}>Seed cache</button></div>;
}

function RequestsProbe() { const requests = useRequests(); return <span>Requests {requests.fetchStatus}</span>; }

function renderProvider(watchRequests = false) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return { queryClient, ...render(<QueryClientProvider client={queryClient}><MemoryRouter><AuthProvider><Probe watchRequests={watchRequests} /></AuthProvider></MemoryRouter></QueryClientProvider>) };
}

describe('AuthProvider session lifecycle', () => {
  it('restores a valid session only after validating it with /auth/me', async () => {
    writeSession(session);
    server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.json(userDto)));
    renderProvider();
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(screen.getByText('Session User')).toBeInTheDocument();
  });

  it('drops expired and invalid sessions', async () => {
    writeSession({ ...session, expiresAt: '2000-01-01T00:00:00Z' });
    const expired = renderProvider();
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expired.unmount();

    writeSession(session);
    server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'expired' }, { status: 401 })));
    renderProvider();
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(readSession()).toBeNull();
  });

  it('logout clears session storage and the TanStack Query cache', async () => {
    writeSession(session);
    server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.json(userDto)));
    const { queryClient } = renderProvider();
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Seed cache' }));
    expect(queryClient.getQueryData(['private'])).toBe('cached');
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(readSession()).toBeNull();
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
  });

  it('aborts in-flight protected requests when logging out', async () => {
    writeSession(session);
    let requestSignal: AbortSignal | undefined;
    server.use(
      http.get(testApiUrl('/auth/me'), () => HttpResponse.json(userDto)),
      http.get(testApiUrl('/requests'), ({ request }) => new Promise<Response>((resolve) => {
        requestSignal = request.signal;
        request.signal.addEventListener('abort', () => resolve(HttpResponse.json({ content: [], page: 0, size: 20, totalElements: 0, totalPages: 0 })), { once: true });
      })),
    );
    const { queryClient } = renderProvider(true);
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    await screen.findByText('Requests fetching');
    expect(requestSignal?.aborted).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(requestSignal?.aborted).toBe(true);
    expect(queryClient.getQueryData(['private'])).toBeUndefined();
  });
});
