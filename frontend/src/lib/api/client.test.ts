import { beforeEach, describe, expect, it, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { apiRequest, ApiError, setUnauthorizedHandler } from './client';
import { setTokenProvider } from './session-token';
import { server } from '@/test/server';
import { testApiUrl } from '@/test/api-url';

describe('typed API client', () => {
  beforeEach(() => { server.resetHandlers(); setTokenProvider(() => null); setUnauthorizedHandler(null); });
  it('sends auth token and does not send a body or content type on GET', async () => {
    setTokenProvider(() => 'session-token');
    const received: Request[] = [];
    server.use(http.get(testApiUrl('/auth/me'), ({ request }) => { received.push(request); return HttpResponse.json({ ok: true }); }));
    await apiRequest('/auth/me');
    expect(received[0]?.headers.get('Authorization')).toBe('Bearer session-token');
    expect(received[0]?.body).toBeNull();
    expect(received[0]?.headers.has('Content-Type')).toBe(false);
  });
  it('maps validation, authorization, retry and non-JSON errors without exposing body', async () => {
    server.use(http.get(testApiUrl('/users'), () => HttpResponse.json({ code: 'VALIDATION_ERROR', message: 'Invalid', details: [{ field: 'email', message: 'Bad email' }] }, { status: 400 })));
    await expect(apiRequest('/users')).rejects.toMatchObject({ status: 400, code: 'VALIDATION_ERROR', details: [{ field: 'email' }] });
    server.use(http.get(testApiUrl('/limited'), () => HttpResponse.json({ code: 'TOO_MANY_REQUESTS', message: 'Slow down' }, { status: 429, headers: { 'Retry-After': '17' } })));
    await expect(apiRequest('/limited')).rejects.toMatchObject({ status: 429, code: 'TOO_MANY_REQUESTS', retryAfterSeconds: 17 });
    server.use(http.get(testApiUrl('/non-json'), () => new HttpResponse('sensitive stack trace', { status: 500 })));
    await expect(apiRequest('/non-json')).rejects.toMatchObject({ code: 'UNKNOWN', message: 'The server returned an unexpected response.' });
    expect(ApiError).toBeDefined();
  });
  it('distinguishes invalid credentials, session expiry, forbidden, and conflict responses', async () => {
    const expired = vi.fn(); setUnauthorizedHandler(expired); setTokenProvider(() => 'active-token');
    server.use(
      http.get(testApiUrl('/invalid-credentials'), () => HttpResponse.json({ code: 'INVALID_CREDENTIALS', message: 'wrong' }, { status: 401 })),
      http.get(testApiUrl('/expired'), () => HttpResponse.json({ code: 'UNAUTHENTICATED', message: 'expired' }, { status: 401 })),
      http.get(testApiUrl('/forbidden'), () => HttpResponse.json({ code: 'FORBIDDEN', message: 'private detail' }, { status: 403 })),
      http.get(testApiUrl('/conflict'), () => HttpResponse.json({ code: 'DUPLICATE_RESOURCE', message: 'duplicate' }, { status: 409 })),
    );
    await expect(apiRequest('/invalid-credentials')).rejects.toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' });
    expect(expired).not.toHaveBeenCalled();
    await expect(apiRequest('/expired')).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(expired).toHaveBeenCalledOnce();
    await expect(apiRequest('/forbidden')).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'You do not have permission to do that.' });
    await expect(apiRequest('/conflict')).rejects.toMatchObject({ status: 409, code: 'DUPLICATE_RESOURCE' });
  });
  it('maps network errors to NETWORK_ERROR', async () => {
    server.use(http.get(testApiUrl('/auth/me'), () => HttpResponse.error()));
    await expect(apiRequest('/auth/me')).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
  it('resolves empty 204 responses without attempting JSON parsing', async () => {
    server.use(
      http.post(testApiUrl('/auth/change-password'), () => new HttpResponse(null, { status: 204 })),
      http.patch(testApiUrl('/notifications/9/read'), () => new HttpResponse(null, { status: 204 })),
      http.patch(testApiUrl('/notifications/read-all'), () => new HttpResponse(null, { status: 204 })),
    );
    await expect(apiRequest<void>('/auth/change-password', { method: 'POST', body: { currentPassword: 'old', newPassword: 'new' } })).resolves.toBeUndefined();
    await expect(apiRequest<void>('/notifications/9/read', { method: 'PATCH', body: { read: true } })).resolves.toBeUndefined();
    await expect(apiRequest<void>('/notifications/read-all', { method: 'PATCH' })).resolves.toBeUndefined();
  });
});
