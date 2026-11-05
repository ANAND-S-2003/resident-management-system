import { randomUUID } from 'node:crypto';
import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const backendApi = 'http://localhost:8080/api/v1';
const sessionKey = 'rms.session.v1';

export interface TestResident {
  fullName: string;
  email: string;
  flatNumber: string;
  password: string;
}

export interface TestAdmin { fullName: string; email: string; password: string }

export interface BrowserAuthSession {
  token: string;
  expiresAt: string;
  user: { id: number; fullName: string; email: string; role: 'USER' | 'ADMIN' | 'SUPER_ADMIN'; flatNumber: string | null; active: boolean };
}

interface BackendLoginResponse {
  accessToken: string;
  expiresAt: string;
  user: Omit<BrowserAuthSession['user'], 'active'>;
}

interface ServiceListResponse {
  content: Array<{ id: number; name: string }>;
}

interface CreatedRequestResponse {
  id: number;
  service: { name: string };
}

export interface ResidentScenario {
  resident: TestResident;
  session: BrowserAuthSession;
  requestId: number | null;
  serviceName: string | null;
}

let superAdminSessionPromise: Promise<BrowserAuthSession> | null = null;
let readOnlyResidentPromise: Promise<TestResident> | null = null;
let readOnlyResidentSessionPromise: Promise<BrowserAuthSession> | null = null;
let readOnlyStaffPromise: Promise<{ admin: TestAdmin; session: BrowserAuthSession }> | null = null;

export function assertNotRateLimited(status: number, action: string): void {
  if (status === 429) {
    throw new Error(`Rate limit reached during ${action}: restart the backend or start it with scripts/start-backend-for-e2e.ps1`);
  }
}

export function residentCredentials(): TestResident {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  return {
    fullName: `E2E Resident ${suffix}`,
    email: `e2e-${suffix}@example.test`,
    flatNumber: `F-${suffix.slice(0, 6)}`,
    password: `Resident-${suffix}-7a`,
  };
}

export function adminCredentials(): TestAdmin {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  return { fullName: `E2E Admin ${suffix}`, email: `e2e-admin-${suffix}@example.test`, password: `Admin-${suffix}-7b` };
}

export function addDaysToDateOnly(dateOnly: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
  if (!match) throw new Error('Expected completion date minimum must be an ISO date.');
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days));
  return date.toISOString().slice(0, 10);
}

export async function superAdminSession(request: APIRequestContext): Promise<BrowserAuthSession> {
  if (!superAdminSessionPromise) {
    const email = process.env.RMS_SUPERADMIN_EMAIL;
    const password = process.env.RMS_SUPERADMIN_PASSWORD;
    if (!email || !password) {
      throw new Error('Super admin E2E credentials are missing; load them with scripts/load-env.ps1.');
    }
    superAdminSessionPromise = loginWithApi(request, email, password);
  }
  return superAdminSessionPromise;
}

export async function superAdminName(): Promise<string> {
  const name = process.env.RMS_SUPERADMIN_NAME;
  if (!name) throw new Error('RMS_SUPERADMIN_NAME is missing; load it with scripts/load-env.ps1.');
  return name;
}

export async function createReadOnlyResident(request: APIRequestContext): Promise<TestResident> {
  if (!readOnlyResidentPromise) {
    readOnlyResidentPromise = (async () => {
      const resident = residentCredentials();
      const response = await request.post(`${backendApi}/auth/register`, { data: resident });
      assertNotRateLimited(response.status(), 'read-only resident registration');
      expect(response.status(), 'Register shared read-only resident test account').toBe(201);
      return resident;
    })();
  }
  return readOnlyResidentPromise;
}

export async function registerResident(request: APIRequestContext, resident: TestResident): Promise<void> {
  const response = await request.post(`${backendApi}/auth/register`, { data: resident });
  assertNotRateLimited(response.status(), 'resident registration');
  expect(response.status(), 'Register unique resident test account').toBe(201);
}

export async function loginWithApi(request: APIRequestContext, email: string, password: string): Promise<BrowserAuthSession> {
  const response = await request.post(`${backendApi}/auth/login`, { data: { email, password } });
  assertNotRateLimited(response.status(), 'API login');
  expect(response.status(), 'API login response status').toBe(200);
  const body = await response.json() as BackendLoginResponse;
  return { token: body.accessToken, expiresAt: body.expiresAt, user: { ...body.user, active: true } };
}

export async function installSession(page: Page, session: BrowserAuthSession): Promise<void> {
  await page.addInitScript(({ key, value }) => {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  }, { key: sessionKey, value: session });
}

export async function createResidentScenario(request: APIRequestContext, withRequest: boolean): Promise<ResidentScenario> {
  const resident = await createReadOnlyResident(request);
  if (!readOnlyResidentSessionPromise) readOnlyResidentSessionPromise = loginWithApi(request, resident.email, resident.password);
  const session = await readOnlyResidentSessionPromise;
  if (!withRequest) return { resident, session, requestId: null, serviceName: null };

  const serviceResponse = await request.get(`${backendApi}/services?page=0&size=100&sort=name%2Casc`, {
    headers: { Authorization: `Bearer ${session.token}` },
  });
  expect(serviceResponse.status(), 'Resident service list response status').toBe(200);
  const services = (await serviceResponse.json()) as ServiceListResponse;
  expect(services.content.length, 'At least one active service must be available').toBeGreaterThan(0);
  const service = services.content[0]!;
  const created = await request.post(`${backendApi}/requests`, {
    headers: { Authorization: `Bearer ${session.token}` },
    data: {
      serviceId: service.id,
      description: `Unique axe request ${randomUUID()}`,
      expectedCompletionDate: addDaysToDateOnly(applicationToday(), 7),
    },
  });
  expect(created.status(), 'Create request for resident test state').toBe(201);
  const requestBody = (await created.json()) as CreatedRequestResponse;
  return { resident, session, requestId: requestBody.id, serviceName: requestBody.service.name };
}

export function applicationToday(): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export async function createAdminAccount(request: APIRequestContext, admin = adminCredentials()): Promise<TestAdmin> {
  const superAdmin = await superAdminSession(request);
  const response = await request.post(`${backendApi}/users`, {
    headers: { Authorization: `Bearer ${superAdmin.token}` },
    data: { ...admin, role: 'ADMIN' },
  });
  assertNotRateLimited(response.status(), 'admin account creation');
  expect(response.status(), 'Create unique ADMIN account').toBe(201);
  return admin;
}

export async function createReadOnlyStaff(request: APIRequestContext): Promise<{ admin: TestAdmin; session: BrowserAuthSession }> {
  if (!readOnlyStaffPromise) {
    readOnlyStaffPromise = (async () => {
      const admin = await createAdminAccount(request);
      const session = await loginWithApi(request, admin.email, admin.password);
      return { admin, session };
    })();
  }
  return readOnlyStaffPromise;
}
