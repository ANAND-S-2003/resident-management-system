import { http, HttpResponse } from 'msw';
import { testApiUrl } from './api-url';
export const handlers = [
  http.get(testApiUrl('/auth/me'), () => HttpResponse.json({ id: 1, fullName: 'Test Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-1', active: true })),
  http.post(testApiUrl('/auth/login'), () => HttpResponse.json({ accessToken: 'test-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z', user: { id: 1, fullName: 'Test Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-1' } })),
];
