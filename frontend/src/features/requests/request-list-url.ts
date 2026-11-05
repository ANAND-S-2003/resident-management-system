import { REQUEST_STATUSES } from '@/lib/constants';
import type { RequestQuery, RequestStatus } from '@/lib/api/types';

export const REQUEST_SORTS = ['createdAt,desc', 'createdAt,asc', 'requestDate,desc', 'requestDate,asc', 'expectedCompletionDate,desc', 'expectedCompletionDate,asc', 'status,asc', 'status,desc'] as const;
export type RequestSort = (typeof REQUEST_SORTS)[number];
export const DEFAULT_REQUEST_SORT: RequestSort = 'createdAt,desc';

export interface StaffRequestListState extends RequestQuery {
  status?: RequestStatus;
  overdue: boolean;
  q: string;
  page: number;
  size: number;
  sort: RequestSort;
}

export function parseStaffRequestListState(search: URLSearchParams): StaffRequestListState {
  const rawStatus = search.get('status');
  const rawPage = Number(search.get('page'));
  const sizeValue = search.get('size');
  const rawSize = Number(sizeValue);
  const rawSort = search.get('sort');
  const q = [...(search.get('q') ?? '').trim()].slice(0, 100).join('');
  return {
    ...(rawStatus && (REQUEST_STATUSES as readonly string[]).includes(rawStatus) ? { status: rawStatus as RequestStatus } : {}),
    overdue: search.get('overdue') === 'true',
    q,
    page: Number.isSafeInteger(rawPage) && rawPage >= 0 ? rawPage : 0,
    size: sizeValue === null || sizeValue.trim() === '' || !Number.isInteger(rawSize) ? 20 : Math.min(100, Math.max(1, rawSize)),
    sort: (REQUEST_SORTS as readonly string[]).includes(rawSort ?? '') ? rawSort as RequestSort : DEFAULT_REQUEST_SORT,
  };
}

export function updateStaffRequestSearch(current: URLSearchParams, changes: Record<string, string | null>, resetPage = true): URLSearchParams {
  const next = new URLSearchParams(current);
  for (const [key, value] of Object.entries(changes)) {
    if (value) next.set(key, value);
    else next.delete(key);
  }
  if (resetPage) next.delete('page');
  return next;
}
