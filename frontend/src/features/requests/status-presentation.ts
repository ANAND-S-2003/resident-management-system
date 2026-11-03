import type { RequestStatus } from '@/lib/api/types';

export interface StatusPresentation { label: string; tone: 'warning' | 'info' | 'success' | 'danger'; accessibleText: string; overdueLabel?: 'Overdue' }

const statusDetails: Record<RequestStatus, Omit<StatusPresentation, 'accessibleText' | 'overdueLabel'>> = {
  PENDING: { label: 'Pending', tone: 'warning' },
  IN_PROGRESS: { label: 'In progress', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
};

export function presentRequestStatus(status: RequestStatus, overdue: boolean): StatusPresentation {
  const details = statusDetails[status];
  return { ...details, accessibleText: overdue ? `${details.label}, Overdue` : details.label, ...(overdue ? { overdueLabel: 'Overdue' as const } : {}) };
}
