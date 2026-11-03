import { http, HttpResponse } from 'msw';
import { testApiUrl } from './api-url';
export const handlers = [
  http.get(testApiUrl('/auth/me'), () => HttpResponse.json({ id: 1, fullName: 'Test Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-1', active: true })),
  http.post(testApiUrl('/auth/login'), () => HttpResponse.json({ accessToken: 'test-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z', user: { id: 1, fullName: 'Test Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-1' } })),
  http.get(testApiUrl('/requests'), ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);
    return HttpResponse.json({ content: [], page, size, totalElements: 0, totalPages: 0 });
  }),
  http.get(testApiUrl('/services'), ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);
    return HttpResponse.json({ content: [], page, size, totalElements: 0, totalPages: 0 });
  }),
  http.get(testApiUrl('/notifications'), ({ request }) => {
    const url = new URL(request.url);
    const page = Number(url.searchParams.get('page') ?? 0);
    const size = Number(url.searchParams.get('size') ?? 20);
    return HttpResponse.json({ content: [], page, size, totalElements: 0, totalPages: 0 });
  }),
  http.get(testApiUrl('/notifications/unread-count'), () => HttpResponse.json({ count: 0 })),
];
