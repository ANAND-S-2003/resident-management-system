import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Select, Skeleton, StatusBadge } from '@/components/ui';
import { REQUEST_STATUSES } from '@/lib/constants';
import type { RequestStatus } from '@/lib/api/types';
import { formatDateOnly } from '@/lib/dates';
import { presentRequestStatus } from './status-presentation';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useRequests } from './hooks';

const SORTS = ['createdAt,desc', 'createdAt,asc', 'requestDate,desc', 'requestDate,asc', 'expectedCompletionDate,desc', 'expectedCompletionDate,asc', 'status,asc', 'status,desc'] as const;
const STATUS_SET = new Set<string>(REQUEST_STATUSES);

function validPage(value: string | null): number { const parsed = Number(value); return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0; }
function validSize(value: string | null): number {
  if (value === null || value.trim() === '') return 20;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(100, Math.max(1, parsed)) : 20;
}

export function RequestListPage() {
  useDocumentTitle('My requests');
  const [search, setSearch] = useSearchParams();
  const rawStatus = search.get('status');
  const status = rawStatus && STATUS_SET.has(rawStatus) ? rawStatus as RequestStatus : undefined;
  const overdue = search.get('overdue') === 'true';
  const rawSort = search.get('sort');
  const sort = SORTS.includes(rawSort as typeof SORTS[number]) ? rawSort as string : 'createdAt,desc';
  const page = validPage(search.get('page'));
  const size = validSize(search.get('size'));
  const params = { ...(status ? { status } : {}), ...(overdue ? { overdue: true } : {}), page, size, sort };
  const requests = useRequests(params);
  const allRequests = useRequests({ page: 0, size: 1, sort: 'createdAt,desc' });
  const filtered = Boolean(status || overdue);
  const update = (changes: Record<string, string | null>, resetPage = true) => {
    const next = new URLSearchParams(search);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    if (resetPage) next.delete('page');
    setSearch(next);
  };
  const reset = () => setSearch(new URLSearchParams());
  if (requests.isLoading || (filtered && requests.data?.totalElements === 0 && allRequests.isLoading)) return <><PageHeader title="My requests" /><Skeleton className="list-skeleton" /><Skeleton className="list-skeleton" /></>;
  if (requests.isError) return <><PageHeader title="My requests" /><ErrorState error={requests.error} onRetry={() => void requests.refetch()} /></>;
  if (filtered && allRequests.isError && requests.data?.totalElements === 0) return <><PageHeader title="My requests" /><ErrorState error={allRequests.error} onRetry={() => void allRequests.refetch()} /></>;
  const content = requests.data?.content ?? [];
  const noRequests = (allRequests.data?.totalElements ?? 0) === 0;
  return <>
    <PageHeader title="My requests" description="Review your service requests and their progress." actions={<Link className="button button-primary" to="/resident/requests/new">New request</Link>} />
    <Card className="request-filters">
      <FormFilter label="Status"><Select aria-label="Status filter" value={status ?? ''} onChange={(event) => update({ status: event.target.value || null })}><option value="">All statuses</option>{REQUEST_STATUSES.map((value) => <option key={value} value={value}>{presentRequestStatus(value, false).label}</option>)}</Select></FormFilter>
      <label className="checkbox-filter"><input type="checkbox" checked={overdue} onChange={(event) => update({ overdue: event.target.checked ? 'true' : null })} /> Overdue only</label>
      <FormFilter label="Sort"><Select aria-label="Sort requests" value={sort} onChange={(event) => update({ sort: event.target.value })}>{SORTS.map((value) => <option key={value} value={value}>{sortLabel(value)}</option>)}</Select></FormFilter>
    </Card>
    {content.length === 0 ? <Card><EmptyState title={noRequests ? 'No requests yet' : 'No requests match these filters'}>{noRequests ? <Link to="/resident/requests/new">Create your first request</Link> : <Button variant="secondary" onClick={reset}>Clear filters</Button>}</EmptyState></Card> : <>
      <div className="request-table-wrap"><table className="request-table"><thead><tr><th scope="col">Request</th><th scope="col">Service</th><th scope="col">Description</th><th scope="col">Request date</th><th scope="col">Expected date</th><th scope="col">Status</th></tr></thead><tbody>{content.map((request) => <tr key={request.id}><td><Link to={`/resident/requests/${encodeURIComponent(String(request.id))}`}>#{request.id}</Link></td><td>{request.service.name}</td><td className="request-description-short">{request.description}</td><td>{formatDateOnly(request.requestDate)}</td><td>{formatDateOnly(request.expectedCompletionDate)}</td><td><StatusBadge status={request.status} overdue={request.overdue} /></td></tr>)}</tbody></table></div>
      <div className="request-mobile-cards">{content.map((request) => <Card key={request.id} className="request-mobile-card"><Link to={`/resident/requests/${encodeURIComponent(String(request.id))}`}><strong>Request #{request.id}: {request.service.name}</strong></Link><p className="request-description-short">{request.description}</p><dl><div><dt>Request date</dt><dd>{formatDateOnly(request.requestDate)}</dd></div><div><dt>Expected date</dt><dd>{formatDateOnly(request.expectedCompletionDate)}</dd></div></dl><StatusBadge status={request.status} overdue={request.overdue} /></Card>)}</div>
      <Pagination page={page} size={size} totalElements={requests.data?.totalElements ?? 0} onPageChange={(value) => update({ page: String(value) }, false)} onSizeChange={(value) => update({ size: String(value) })} />
    </>}
  </>;
}

function FormFilter({ label, children }: { label: string; children: React.ReactNode }) { return <div className="request-filter"><label>{label}{children}</label></div>; }
function sortLabel(value: string) { const [field, direction] = value.split(','); return `${field === 'createdAt' ? 'Created' : field === 'requestDate' ? 'Request date' : field === 'expectedCompletionDate' ? 'Expected date' : 'Status'} (${direction})`; }
