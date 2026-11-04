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

export function residentCredentials(): TestResident {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 10);
  return {
    fullName: `E2E Resident ${suffix}`,
    email: `e2e-${suffix}@example.test`,
    flatNumber: `F-${suffix.slice(0, 6)}`,
    password: `Resident-${suffix}-7a`,
  };
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

export async function createResident(request: APIRequestContext): Promise<TestResident> {
  const resident = residentCredentials();
  const admin = await superAdminSession(request);
  const response = await request.post(`${backendApi}/users`, {
    headers: { Authorization: `Bearer ${admin.token}` },
    data: { ...resident, role: 'USER' },
  });
  expect(response.status(), 'Create unique resident test account').toBe(201);
  return resident;
}

export async function registerResident(request: APIRequestContext, resident: TestResident): Promise<void> {
  const response = await request.post(`${backendApi}/auth/register`, { data: resident });
  expect(response.status(), 'Register unique resident test account').toBe(201);
}

export async function loginWithApi(request: APIRequestContext, email: string, password: string): Promise<BrowserAuthSession> {
  const response = await request.post(`${backendApi}/auth/login`, { data: { email, password } });
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
  const resident = await createResident(request);
  const session = await loginWithApi(request, resident.email, resident.password);
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

function applicationToday(): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
