export const headings = {
  login: 'Sign in',
  register: 'Create your resident account',
  staffDashboard: 'Admin dashboard',
  staffRequests: 'Requests',
  forbidden: 'Access denied',
  requests: 'My requests',
  newRequest: 'New request',
  notifications: 'Notifications',
  account: 'Account',
  requestNotFound: 'Request not found',
} as const;

export function residentDashboardHeading(fullName: string): string {
  return `Welcome, ${fullName.trim().split(/\s+/)[0] ?? 'Resident'}`;
}

export function requestDetailHeading(requestId: number, serviceName: string): string {
  return `Request #${requestId}: ${serviceName}`;
}

export function staffRequestDetailHeading(requestId: number, serviceName: string): string {
  return requestDetailHeading(requestId, serviceName);
}

export type AxePageState = 'login' | 'register' | 'resident-desktop' | 'resident-mobile' | 'super-admin-desktop' | 'super-admin-mobile';
export type ResidentFeaturePage = 'dashboard' | 'new-request' | 'requests-list' | 'request-detail' | 'notifications' | 'account';

export function axePageHeading(state: AxePageState, residentName?: string): string {
  if (state === 'login') return headings.login;
  if (state === 'register') return headings.register;
  if (state.startsWith('resident')) {
    if (!residentName) throw new Error('Resident name is required to determine the resident dashboard heading.');
    return residentDashboardHeading(residentName);
  }
  return headings.staffDashboard;
}

export function residentFeatureHeading(
  state: ResidentFeaturePage,
  values: { fullName?: string; requestId?: number; serviceName?: string } = {},
): string {
  if (state === 'dashboard') {
    if (!values.fullName) throw new Error('Resident name is required for the resident dashboard heading.');
    return residentDashboardHeading(values.fullName);
  }
  if (state === 'request-detail') {
    if (values.requestId === undefined || !values.serviceName) {
      throw new Error('Request ID and service name are required for the request detail heading.');
    }
    return requestDetailHeading(values.requestId, values.serviceName);
  }
  return state === 'new-request' ? headings.newRequest
    : state === 'requests-list' ? headings.requests
      : state === 'notifications' ? headings.notifications
        : headings.account;
}
