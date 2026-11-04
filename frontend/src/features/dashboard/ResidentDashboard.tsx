import { Link } from 'react-router-dom';
import { Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthProvider';
import { formatDateOnly } from '@/lib/dates';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { REQUEST_STATUSES } from '@/lib/constants';
import { useRequests, useUnreadCount } from '@/features/requests/hooks';

const statusCards = [
  { status: REQUEST_STATUSES[0], label: 'Pending' }, { status: REQUEST_STATUSES[1], label: 'In progress' },
  { status: REQUEST_STATUSES[2], label: 'Completed' }, { status: REQUEST_STATUSES[3], label: 'Rejected' },
] as const;

export function ResidentDashboard() {
  const { user } = useAuth();
  useDocumentTitle('Resident dashboard');
  const pending = useRequests({ status: REQUEST_STATUSES[0], page: 0, size: 1, sort: 'createdAt,desc' });
  const inProgress = useRequests({ status: REQUEST_STATUSES[1], page: 0, size: 1, sort: 'createdAt,desc' });
  const completed = useRequests({ status: REQUEST_STATUSES[2], page: 0, size: 1, sort: 'createdAt,desc' });
  const rejected = useRequests({ status: REQUEST_STATUSES[3], page: 0, size: 1, sort: 'createdAt,desc' });
  const overdue = useRequests({ overdue: true, page: 0, size: 1, sort: 'createdAt,desc' });
  const recent = useRequests({ page: 0, size: 5, sort: 'createdAt,desc' });
  const unread = useUnreadCount();
  const queries = [pending, inProgress, completed, rejected, overdue, recent, unread];
  const retry = () => queries.forEach((query) => { void query.refetch(); });
  const loading = queries.some((query) => query.isLoading);
  const failed = queries.find((query) => query.isError);
  if (loading) return <><PageHeader title={`Welcome, ${user?.fullName.split(/\s+/)[0] ?? 'Resident'}`} description="Your community requests at a glance." /><section className="resident-stat-grid" aria-label="Request summaries">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="stat-skeleton" />)}</section><Skeleton className="recent-skeleton" /></>;
  if (failed) return <><PageHeader title={`Welcome, ${user?.fullName.split(/\s+/)[0] ?? 'Resident'}`} /><ErrorState error={failed.error} onRetry={retry} /></>;
  const countByStatus = [pending.data?.totalElements ?? 0, inProgress.data?.totalElements ?? 0, completed.data?.totalElements ?? 0, rejected.data?.totalElements ?? 0];
  return <>
    <PageHeader title={`Welcome, ${user?.fullName.split(/\s+/)[0] ?? 'Resident'}`} description="Your community requests at a glance." actions={<Link className="button button-primary" to="/resident/requests/new">New request</Link>} />
    <section className="resident-stat-grid" aria-label="Request summaries">
      {statusCards.map((card, index) => <Link className="resident-stat-link" key={card.status} to={`/resident/requests?status=${card.status}`}><Card className="resident-stat"><StatusBadge status={card.status} /><strong>{countByStatus[index]}</strong><span>{card.label} requests</span></Card></Link>)}
      <Link className="resident-stat-link" to="/resident/requests?overdue=true"><Card className="resident-stat"><StatusBadge status={REQUEST_STATUSES[0]} overdue /><strong>{overdue.data?.totalElements ?? 0}</strong><span>Overdue requests</span></Card></Link>
      <Link className="resident-stat-link" to="/resident/notifications"><Card className="resident-stat"><span>Notifications</span><strong>{unread.data?.count ?? 0}</strong><span>Unread</span></Card></Link>
    </section>
    <section className="recent-requests" aria-labelledby="recent-requests-heading">
      <div className="section-heading"><h2 id="recent-requests-heading">Recent requests</h2><Link to="/resident/requests">View all</Link></div>
      {(recent.data?.content.length ?? 0) === 0 ? <Card><EmptyState title="No requests yet"><Link to="/resident/requests/new">Create your first request</Link></EmptyState></Card> : <div className="request-card-list">{recent.data?.content.map((request) => <Link className="request-card-link" key={request.id} to={`/resident/requests/${encodeURIComponent(String(request.id))}`}><Card className="request-card"><div className="request-card-heading"><strong>#{request.id} {request.service.name}</strong><StatusBadge status={request.status} overdue={request.overdue} /></div><p>{request.description}</p><small>Expected {formatDateOnly(request.expectedCompletionDate)}</small></Card></Link>)}</div>}
    </section>
  </>;
}
