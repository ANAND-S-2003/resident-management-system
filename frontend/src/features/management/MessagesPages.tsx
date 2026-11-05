import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
} from "@/components/ui";
import { formatTimestamp } from "@/lib/dates";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useContactQueries, useContactQuery } from "./hooks";

function listState(search: URLSearchParams) {
  const p = Number(search.get("page"));
  const raw = search.get("size");
  const s = Number(raw);
  const sort = search.get("sort");
  return {
    page: Number.isSafeInteger(p) && p >= 0 ? p : 0,
    size:
      raw === null
        ? 20
        : Number.isInteger(s)
          ? Math.min(100, Math.max(1, s))
          : 20,
    sort: sort === "createdAt,asc" ? "createdAt,asc" : "createdAt,desc",
  };
}

export function MessagesPage() {
  useDocumentTitle("Messages");
  const [search, setSearch] = useSearchParams();
  const state = listState(search);
  const queries = useContactQueries(state);
  const records = queries.data?.content ?? [];
  const update = (changes: Record<string, string | null>, reset = true) => {
    const next = new URLSearchParams(search);
    Object.entries(changes).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    if (reset) next.delete("page");
    setSearch(next);
  };
  if (queries.isLoading)
    return (
      <>
        <PageHeader title="Messages" />
        <Skeleton className="list-skeleton" />
        <Skeleton className="list-skeleton" />
      </>
    );
  if (queries.isError)
    return (
      <>
        <PageHeader title="Messages" />
        <ErrorState
          error={queries.error}
          onRetry={() => void queries.refetch()}
        />
      </>
    );
  return (
    <>
      <PageHeader
        title="Messages"
        description="Contact messages submitted by visitors and residents."
      />
      {records.length === 0 ? (
        <Card>
          <EmptyState title="No messages yet">
            New contact messages will appear here.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Received</th>
                  <th>Message</th>
                  <th>Sender</th>
                </tr>
              </thead>
              <tbody>
                {records.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        to={`/admin/messages/${encodeURIComponent(String(item.id))}`}
                      >
                        {item.subject}
                      </Link>
                    </td>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{formatTimestamp(item.createdAt)}</td>
                    <td>
                      {[...item.message].slice(0, 80).join("")}
                      {[...item.message].length > 80 ? "..." : ""}
                    </td>
                    <td>
                      {item.submittedById === null ? (
                        <Badge tone="neutral">Visitor</Badge>
                      ) : (
                        <Badge tone="info">Signed-in resident</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="management-cards">
            {records.map((item) => (
              <Card className="management-card" key={item.id}>
                <h2>
                  <Link
                    to={`/admin/messages/${encodeURIComponent(String(item.id))}`}
                  >
                    {item.subject}
                  </Link>
                </h2>
                <p>
                  {item.name} · {item.email}
                </p>
                <p>
                  {[...item.message].slice(0, 80).join("")}
                  {[...item.message].length > 80 ? "..." : ""}
                </p>
                <time>{formatTimestamp(item.createdAt)}</time>
                <p>
                  {item.submittedById === null ? (
                    <Badge>Visitor</Badge>
                  ) : (
                    <Badge tone="info">Signed-in resident</Badge>
                  )}
                </p>
              </Card>
            ))}
          </div>
          <Pagination
            page={state.page}
            size={state.size}
            totalElements={queries.data?.totalElements ?? 0}
            onPageChange={(page) => update({ page: String(page) }, false)}
            onSizeChange={(size) => update({ size: String(size) })}
          />
        </>
      )}
    </>
  );
}

export function MessageDetailPage() {
  const { id: rawId } = useParams();
  const id = positiveId(rawId);
  useDocumentTitle(id ? "Message details" : "Message not found");
  const query = useContactQuery(id ?? 0, id !== null);
  if (id === null) return <MessageNotFound />;
  if (query.isLoading)
    return (
      <>
        <PageHeader title="Message details" />
        <Skeleton className="list-skeleton" />
      </>
    );
  if (query.isError) {
    if (
      query.error instanceof Error &&
      "status" in query.error &&
      query.error.status === 404
    )
      return <MessageNotFound />;
    return (
      <>
        <PageHeader title="Message details" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  }
  const message = query.data!;
  return (
    <>
      <PageHeader title={message.subject} description="Contact message" />
      <section
        className="message-detail"
        aria-label="Message details"
      >
        <Card className="message-detail-card">
          <dl>
            <div>
              <dt>From</dt>
              <dd>{message.name}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${encodeURIComponent(message.email)}`}>
                  {message.email}
                </a>
              </dd>
            </div>
            <div>
              <dt>Received</dt>
              <dd>{formatTimestamp(message.createdAt)}</dd>
            </div>
            <div>
              <dt>Sender</dt>
              <dd>
                {message.submittedById === null ? (
                  <Badge>Visitor</Badge>
                ) : (
                  <Badge tone="info">Signed-in resident</Badge>
                )}
              </dd>
            </div>
          </dl>
          <h2>Message</h2>
          <p className="plain-text-message">{message.message}</p>
          <Link
            className="button button-secondary button-md"
            to="/admin/messages"
          >
            Back to messages
          </Link>
        </Card>
      </section>
    </>
  );
}

function MessageNotFound() {
  return (
    <>
      <PageHeader
        title="Message not found"
        description="This message could not be found."
      />
      <Link to="/admin/messages">Back to messages</Link>
    </>
  );
}
function positiveId(value: string | undefined): number | null {
  if (!value || !/^\d+$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
