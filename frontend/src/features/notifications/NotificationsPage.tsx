import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Pagination,
  Skeleton,
  useToast,
} from "@/components/ui";
import { friendlyErrorMessage } from "@/lib/api/friendly-errors";
import { formatTimestamp } from "@/lib/dates";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
  useUnreadCount,
} from "@/features/requests/hooks";

const DEFAULT_PAGE_SIZE = 20;

export function NotificationsPage() {
  useDocumentTitle("Notifications");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const toast = useToast();
  const query = useNotifications({
    unreadOnly: unreadOnly || undefined,
    page,
    size,
    sort: "createdAt,desc",
  });
  const unread = useUnreadCount();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unreadTotal = unread.data?.count ?? 0;
  const markAllRead = async () => {
    try {
      await markAll.mutateAsync();
      toast("All notifications marked as read.");
    } catch (error) {
      toast(friendlyErrorMessage(error), "error");
    }
  };
  if (query.isLoading)
    return (
      <>
        <PageHeader title="Notifications" />
        <Skeleton className="list-skeleton" />
        <Skeleton className="list-skeleton" />
      </>
    );
  if (query.isError)
    return (
      <>
        <PageHeader title="Notifications" />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    );
  const content = query.data?.content ?? [];
  return (
    <>
      <PageHeader
        title="Notifications"
        description="Updates about your service requests."
        actions={
          <Button
            variant="secondary"
            disabled={!unreadTotal || markAll.isPending}
            loading={markAll.isPending}
            onClick={() => void markAllRead()}
          >
            Mark all as read
          </Button>
        }
      />
      <div className="notification-filters">
        <label>
          <input
            type="checkbox"
            checked={unreadOnly}
            onChange={(event) => {
              setUnreadOnly(event.target.checked);
              setPage(0);
            }}
          />{" "}
          Unread only
        </label>
        <span>{unreadTotal} unread</span>
      </div>
      {content.length === 0 ? (
        <Card>
          <EmptyState
            title={
              unreadOnly ? "No unread notifications" : "No notifications yet"
            }
          >
            {unreadOnly ? (
              <Button variant="secondary" onClick={() => setUnreadOnly(false)}>
                Show all notifications
              </Button>
            ) : (
              <Link to="/resident/requests">View your requests</Link>
            )}
          </EmptyState>
        </Card>
      ) : (
        <>
          <ul className="notification-list">
            {content.map((item) => (
              <li key={item.id}>
                <Card
                  className={`notification-card${item.read ? "" : " notification-unread"}`}
                >
                  <div className="notification-heading">
                    <div>
                      {!item.read && (
                        <>
                          <span className="unread-dot" aria-hidden="true" />
                          <span className="sr-only">Unread: </span>
                          <span className="badge badge-info">New</span>
                        </>
                      )}
                    </div>
                    <time dateTime={item.createdAt}>
                      {formatTimestamp(item.createdAt)}
                    </time>
                  </div>
                  <p>{item.message}</p>
                  <div className="notification-actions">
                    <Link
                      to={`/resident/requests/${encodeURIComponent(String(item.requestId))}`}
                    >
                      View request
                    </Link>
                    {!item.read && (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={markRead.isPending}
                        onClick={() =>
                          markRead.mutate(item.id, {
                            onError: (error) =>
                              toast(friendlyErrorMessage(error), "error"),
                          })
                        }
                      >
                        Mark as read
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
          <Pagination
            page={page}
            size={query.data?.size ?? size}
            totalElements={query.data?.totalElements ?? 0}
            onPageChange={setPage}
            onSizeChange={(value) => {
              setSize(value);
              setPage(0);
            }}
          />
        </>
      )}
    </>
  );
}
