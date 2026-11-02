import { http, HttpResponse } from 'msw';
export const handlers = [
  http.get('/api/v1/auth/me', () => HttpResponse.json({ id: 1, fullName: 'Test Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-1', active: true })),
  http.post('/api/v1/auth/login', () => HttpResponse.json({ accessToken: 'test-token', tokenType: 'Bearer', expiresAt: '2099-01-01T00:00:00Z', user: { id: 1, fullName: 'Test Resident', email: 'resident@example.test', role: 'USER', flatNumber: 'A-1' } })),
];
