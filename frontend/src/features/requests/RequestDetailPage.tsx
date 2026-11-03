import { Link, useParams } from 'react-router-dom';
import { ApiError } from '@/lib/api/client';
import { friendlyErrorMessage } from '@/lib/api/friendly-errors';
import { formatDateOnly, formatTimestamp } from '@/lib/dates';
import { useDocumentTitle } from '@/lib/useDocumentTitle';
import { Card, ErrorState, PageHeader, Skeleton, StatusBadge } from '@/components/ui';
import { useRequest, useRequestHistory } from './hooks';
import { presentRequestStatus } from './status-presentation';

export function RequestDetailPage() {
  const { id: rawId } = useParams();
  const id = rawId && /^[1-9]\d*$/.test(rawId) && Number.isSafeInteger(Number(rawId)) ? Number(rawId) : null;
  const request = useRequest(id ?? 0, id !== null);
  const history = useRequestHistory(id ?? 0, id !== null && request.isSuccess);
  useDocumentTitle(id === null ? 'Request not found' : request.data ? `Request #${id}` : 'Request details');
  if (id === null || (request.error instanceof ApiError && request.error.status === 404)) return <NotFoundRequest />;
  if (request.isLoading) return <><PageHeader title="Request details" /><Skeleton className="detail-skeleton" /><Skeleton className="detail-skeleton" /></>;
  if (request.isError) return <><PageHeader title="Request details" /><ErrorState error={request.error} onRetry={() => void request.refetch()} /></>;
  const item = request.data;
  if (!item) return <><PageHeader title="Request details" /><ErrorState error={request.error} onRetry={() => void request.refetch()} /></>;
  const status = presentRequestStatus(item.status, item.overdue);
  return <>
    <PageHeader title={`Request #${item.id}: ${item.service.name}`} description="Request details and status history." />
    <Card className="request-detail-card">
      <div className="detail-badges"><StatusBadge status={item.status} overdue={item.overdue} /></div>
      <dl className="request-definition-list">
        <Detail label="Service">{item.service.name}</Detail>
        <Detail label="Description"><span className="preserve-lines">{item.description}</span></Detail>
        <Detail label="Flat number">{item.flatNumber}</Detail>
        <Detail label="Request date">{formatDateOnly(item.requestDate)}</Detail>
        <Detail label="Expected completion date">{formatDateOnly(item.expectedCompletionDate)}</Detail>
        <Detail label="Status">{status.label}{item.overdue ? ' - Overdue' : ''}</Detail>
        <Detail label="Admin remarks"><span className="preserve-lines">{item.adminRemarks || 'No remarks yet'}</span></Detail>
        <Detail label="Created">{formatTimestamp(item.createdAt)}</Detail>
        <Detail label="Last updated">{formatTimestamp(item.updatedAt)}</Detail>
      </dl>
    </Card>
    <section className="request-history" aria-labelledby="history-title">
      <h2 id="history-title">Status history</h2>
      {history.isLoading ? <Skeleton className="history-skeleton" /> : history.isError ? <ErrorState error={history.error} onRetry={() => void history.refetch()} /> : (history.data?.length ?? 0) === 0 ? <Card><p>No status history is available.</p></Card> : <ol className="history-timeline">{history.data?.map((entry, index) => <li key={`${entry.createdAt}-${index}`}><Card><strong>{entry.fromStatus === null ? `Created as ${presentRequestStatus(entry.toStatus, false).label}` : `From ${presentRequestStatus(entry.fromStatus, false).label} to ${presentRequestStatus(entry.toStatus, false).label}`}</strong><p>Changed by {entry.changedBy.fullName}</p><time dateTime={entry.createdAt}>{formatTimestamp(entry.createdAt)}</time>{entry.remarks && <p className="preserve-lines">{entry.remarks}</p>}</Card></li>)}</ol>}
    </section>
  </>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) { return <div><dt>{label}</dt><dd>{children}</dd></div>; }
function NotFoundRequest() { return <section className="standalone-page"><PageHeader title="Request not found" description={friendlyErrorMessage(new ApiError(404, 'NOT_FOUND', 'not found'))} /><Link className="button button-secondary" to="/resident/requests">Back to my requests</Link></section>; }
