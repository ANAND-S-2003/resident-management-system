import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorState, FormField, Input, PageHeader, Pagination, Select, Skeleton, StatusBadge } from '@/components/ui';
import { REQUEST_STATUSES } from '@/lib/constants';
import type { ServiceRequest } from '@/lib/api/types';
import { formatDateOnly } from '@/lib/dates';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useStaffRequests } from './hooks';
import { DEFAULT_REQUEST_SORT, parseStaffRequestListState, REQUEST_SORTS, updateStaffRequestSearch } from './request-list-url';
import { presentRequestStatus } from './status-presentation';

export function StaffRequestListPage() {
  useDocumentTitle('Requests');
  const [search, setSearch] = useSearchParams();
  const state = parseStaffRequestListState(search);
  const [queryDraft, setQueryDraft] = useState(state.q);
  useEffect(() => setQueryDraft(state.q), [state.q]);
  useEffect(() => {
    if (queryDraft === state.q) return;
    const timer = window.setTimeout(() => setSearch(updateStaffRequestSearch(search, { q: [...queryDraft.trim()].slice(0, 100).join('') || null })), 400);
    return () => window.clearTimeout(timer);
  }, [queryDraft, search, setSearch, state.q]);

  const params = { ...(state.status ? { status: state.status } : {}), ...(state.overdue ? { overdue: true } : {}), ...(state.q ? { q: state.q } : {}), page: state.page, size: state.size, sort: state.sort };
  const requests = useStaffRequests(params);
  const allRequests = useStaffRequests({ page: 0, size: 1, sort: DEFAULT_REQUEST_SORT });
  const filtered = Boolean(state.status || state.overdue || state.q);
  const update = (changes: Record<string, string | null>, resetPage = true) => setSearch(updateStaffRequestSearch(search, changes, resetPage));
  const clearFilters = () => { setQueryDraft(''); setSearch(new URLSearchParams()); };

  if (requests.isLoading || (filtered && requests.data?.totalElements === 0 && allRequests.isLoading)) return <><PageHeader title="Requests" /><Skeleton className="list-skeleton" /><Skeleton className="list-skeleton" /></>;
  if (requests.isError) return <><PageHeader title="Requests" /><ErrorState error={requests.error} onRetry={() => void requests.refetch()} /></>;
  if (filtered && allRequests.isError && requests.data?.totalElements === 0) return <><PageHeader title="Requests" /><ErrorState error={allRequests.error} onRetry={() => void allRequests.refetch()} /></>;

  const content = requests.data?.content ?? [];
  const noRequests = (allRequests.data?.totalElements ?? 0) === 0;
  return <>
    <PageHeader title="Requests" description="Review and manage requests across the community." />
    <Card className="request-filters staff-request-filters">
      <FormField id="staff-request-status" label="Status"><Select value={state.status ?? ''} onChange={(event) => update({ status: event.target.value || null })}><option value="">All statuses</option>{REQUEST_STATUSES.map((status) => <option key={status} value={status}>{presentRequestStatus(status, false).label}</option>)}</Select></FormField>
      <label className="checkbox-filter"><input type="checkbox" checked={state.overdue} onChange={(event) => update({ overdue: event.target.checked ? 'true' : null })} /> Overdue only</label>
      <FormField id="staff-request-search" label="Search residents" hint="Search by resident name or flat"><Input value={queryDraft} maxLength={200} placeholder="Search by resident name or flat" onChange={(event) => setQueryDraft([...event.target.value].slice(0, 100).join(''))} /></FormField>
      <FormField id="staff-request-sort" label="Sort"><Select value={state.sort} onChange={(event) => update({ sort: event.target.value })}>{REQUEST_SORTS.map((value) => <option key={value} value={value}>{sortLabel(value)}</option>)}</Select></FormField>
    </Card>
    {content.length === 0 ? <Card><EmptyState title={noRequests ? 'No requests yet' : 'No requests match these filters'}>{noRequests ? 'New resident requests will appear here.' : <Button variant="secondary" onClick={clearFilters}>Clear filters</Button>}</EmptyState></Card> : <>
      <div className="request-table-wrap"><table className="request-table staff-request-table"><thead><tr><th scope="col">Request</th><th scope="col">Resident</th><th scope="col">Flat</th><th scope="col">Service</th><th scope="col">Request date</th><th scope="col">Expected date</th><th scope="col">Status</th></tr></thead><tbody>{content.map((request) => <tr key={request.id}><td><Link to={`/admin/requests/${encodeURIComponent(String(request.id))}`}>#{request.id}</Link></td><td>{request.resident.fullName}</td><td>{request.flatNumber}</td><td>{request.service.name}</td><td>{formatDateOnly(request.requestDate)}</td><td>{formatDateOnly(request.expectedCompletionDate)}</td><td><StatusBadge status={request.status} overdue={request.overdue} /></td></tr>)}</tbody></table></div>
      <div className="request-mobile-cards staff-request-mobile-cards">{content.map((request) => <StaffRequestCard key={request.id} request={request} />)}</div>
      <Pagination page={state.page} size={state.size} totalElements={requests.data?.totalElements ?? 0} onPageChange={(page) => update({ page: String(page) }, false)} onSizeChange={(size) => update({ size: String(size) })} />
    </>}
  </>;
}

function StaffRequestCard({ request }: { request: ServiceRequest }) {
  return <Card className="request-mobile-card"><Link to={`/admin/requests/${encodeURIComponent(String(request.id))}`}><strong>Request #{request.id}: {request.service.name}</strong></Link><p>{request.resident.fullName} - flat {request.flatNumber}</p><dl><div><dt>Request date</dt><dd>{formatDateOnly(request.requestDate)}</dd></div><div><dt>Expected date</dt><dd>{formatDateOnly(request.expectedCompletionDate)}</dd></div></dl><StatusBadge status={request.status} overdue={request.overdue} /></Card>;
}

function sortLabel(value: string) { const [field, direction] = value.split(','); return `${field === 'createdAt' ? 'Created' : field === 'requestDate' ? 'Request date' : field === 'expectedCompletionDate' ? 'Expected date' : 'Status'} (${direction})`; }
