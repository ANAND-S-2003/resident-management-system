import { Link } from 'react-router-dom';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { REQUEST_STATUSES, ROLES } from '@/lib/constants';
import { formatDateOnly } from '@/lib/dates';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { useDashboardSummary, useStaffRequests } from '@/features/requests/hooks';
import type { RequestStatus, ServiceRequest } from '@/lib/api/types';
import { presentRequestStatus } from '@/features/requests/status-presentation';

const summaryCards = [
  { status: REQUEST_STATUSES[0], label: 'Pending' },
  { status: REQUEST_STATUSES[1], label: 'In progress' },
  { status: REQUEST_STATUSES[2], label: 'Completed' },
  { status: REQUEST_STATUSES[3], label: 'Rejected' },
] as const;

export function StaffDashboard() {
  const { user } = useAuth();
  useDocumentTitle('Admin dashboard');
  const summary = useDashboardSummary();
  const pending = useStaffRequests({ status: REQUEST_STATUSES[0], page: 0, size: 5, sort: 'createdAt,asc' });
  const overdue = useStaffRequests({ overdue: true, page: 0, size: 5, sort: 'expectedCompletionDate,asc' });
  const queries = [summary, pending, overdue];
  const retry = () => queries.forEach((query) => { void query.refetch(); });
  const failure = queries.find((query) => query.isError);
  if (queries.some((query) => query.isLoading)) return <><PageHeader title="Admin dashboard" description="Request activity across the community." /><section className="staff-summary-grid" aria-label="Request summaries">{Array.from({ length: 7 }, (_, index) => <Skeleton key={index} className="stat-skeleton" />)}</section><Skeleton className="list-skeleton" /></>;
  if (failure) return <><PageHeader title="Admin dashboard" /><ErrorState error={failure.error} onRetry={retry} /></>;
  const data = summary.data;
  if (!data) return <><PageHeader title="Admin dashboard" /><ErrorState error={summary.error} onRetry={retry} /></>;
  return <>
    <PageHeader title="Admin dashboard" description="Request activity across the community." />
    <section className="staff-summary-grid" aria-label="Request summaries">
      {summaryCards.map(({ status, label }) => <SummaryCard key={status} label={label} count={data.byStatus[status]} href={`/admin/requests?status=${status}`} status={status} />)}
      <SummaryCard label="Overdue" count={data.overdueCount} href="/admin/requests?overdue=true" />
    </section>
    <section className="staff-totals" aria-label="Community totals">
      <Card><h2>Total requests</h2><strong>{data.totalRequests}</strong></Card>
      <Card><h2>Active residents</h2><strong>{data.activeResidents}</strong></Card>
      {user?.role === ROLES[2] && data.activeAdmins !== undefined && <Card><h2>Active admins</h2><strong>{data.activeAdmins}</strong></Card>}
    </section>
    <section className="staff-attention" aria-labelledby="staff-attention-title">
      <h2 id="staff-attention-title">Needs attention</h2>
      <div className="staff-attention-grid">
        <Card><h3>Oldest pending requests</h3>{pending.data?.content.length ? <RequestRows requests={pending.data.content} /> : <EmptyState title="Nothing is waiting" />}</Card>
        <Card><h3>Most overdue requests</h3>{overdue.data?.content.length ? <RequestRows requests={overdue.data.content} /> : <EmptyState title="Nothing is overdue" />}</Card>
      </div>
    </section>
  </>;
}

function SummaryCard({ label, count, href, status }: { label: string; count: number; href: string; status?: RequestStatus }) {
  return <Link className="resident-stat-link" to={href}><Card className="resident-stat">{status ? <StatusBadge status={status} /> : <span className="badge badge-danger">Overdue</span>}<strong>{count}</strong><span>{label} requests</span></Card></Link>;
}

function RequestRows({ requests }: { requests: ServiceRequest[] }) {
  return <ul className="staff-attention-list">{requests.map((request) => <li key={request.id}><Link to={`/admin/requests/${encodeURIComponent(String(request.id))}`}><strong>#{request.id} {request.service.name}</strong><span>{request.resident.fullName} - flat {request.flatNumber}</span></Link><div><StatusBadge status={request.status} overdue={request.overdue} /><time dateTime={request.expectedCompletionDate}>{formatDateOnly(request.expectedCompletionDate)}</time></div></li>)}</ul>;
}

export function statusLabel(status: RequestStatus) { return presentRequestStatus(status, false).label; }
