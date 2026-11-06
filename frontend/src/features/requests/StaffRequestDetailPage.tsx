import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Dialog,
  ErrorState,
  FormField,
  PageHeader,
  Skeleton,
  StatusBadge,
  Textarea,
  useToast,
} from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import {
  apiFieldErrors,
  friendlyErrorMessage,
} from "@/lib/api/friendly-errors";
import type { RequestAction } from "./request-actions";
import { formatDateOnly, formatTimestamp } from "@/lib/dates";
import { REQUEST_STATUSES } from "@/lib/constants";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
  useStaffRequest,
  useStaffRequestHistory,
  useUpdateStaffRequest,
} from "./hooks";
import { requestActions } from "./request-actions";
import { presentRequestStatus } from "./status-presentation";

export function StaffRequestDetailPage() {
  const { id: rawId } = useParams();
  const id =
    rawId && /^[1-9]\d*$/.test(rawId) && Number.isSafeInteger(Number(rawId))
      ? Number(rawId)
      : null;
  const request = useStaffRequest(id ?? 0, id !== null);
  const history = useStaffRequestHistory(id ?? 0, id !== null);
  const [activeAction, setActiveAction] = useState<RequestAction | null>(null);
  const [dialogRemarks, setDialogRemarks] = useState("");
  const [startRemarks, setStartRemarks] = useState("");
  const [remarksDraft, setRemarksDraft] = useState("");
  const [remarksError, setRemarksError] = useState("");
  const [startRemarksError, setStartRemarksError] = useState("");
  const [formError, setFormError] = useState("");
  const [remarksOnlyError, setRemarksOnlyError] = useState("");
  const update = useUpdateStaffRequest(id ?? 0);
  const toast = useToast();
  useDocumentTitle(
    id === null
      ? "Request not found"
      : request.data
        ? `Request #${id}`
        : "Request details",
  );

  if (
    id === null ||
    (request.error instanceof ApiError && request.error.status === 404)
  )
    return <NotFoundRequest />;
  if (request.isLoading || history.isLoading)
    return (
      <>
        <PageHeader title="Request details" />
        <Skeleton className="detail-skeleton" />
        <Skeleton className="detail-skeleton" />
      </>
    );
  if (request.isError)
    return (
      <>
        <PageHeader title="Request details" />
        <ErrorState
          error={request.error}
          onRetry={() => void request.refetch()}
        />
      </>
    );
  if (history.isError)
    return (
      <>
        <PageHeader title="Request details" />
        <ErrorState
          error={history.error}
          onRetry={() => void history.refetch()}
        />
      </>
    );
  const item = request.data;
  if (!item)
    return (
      <>
        <PageHeader title="Request details" />
        <ErrorState
          error={request.error}
          onRetry={() => void request.refetch()}
        />
      </>
    );
  const actions = requestActions(item.status);
  const isOpen =
    item.status === REQUEST_STATUSES[0] || item.status === REQUEST_STATUSES[1];

  const closeDialog = () => {
    if (!update.isPending) {
      setActiveAction(null);
      setDialogRemarks("");
      setRemarksError("");
      setFormError("");
    }
  };
  const handleUpdateError = async (
    error: unknown,
    field: "dialog" | "start" | "remarks",
  ) => {
    if (
      error instanceof ApiError &&
      error.status === 409 &&
      (error.code === "INVALID_STATUS_TRANSITION" ||
        error.code === "CONCURRENT_MODIFICATION")
    ) {
      if (field === "remarks")
        setRemarksOnlyError(
          "This request was just updated by someone else. We loaded the latest version.",
        );
      else
        setFormError(
          "This request was just updated by someone else. We loaded the latest version.",
        );
      await Promise.all([request.refetch(), history.refetch()]);
      return;
    }
    const errors = apiFieldErrors(error);
    if (errors.adminRemarks) {
      if (field === "remarks") setRemarksOnlyError(errors.adminRemarks);
      else if (field === "start") setStartRemarksError(errors.adminRemarks);
      else setRemarksError(errors.adminRemarks);
      return;
    }
    const message = friendlyErrorMessage(error);
    if (field === "remarks") setRemarksOnlyError(message);
    else setFormError(message);
  };
  const applyStatus = async (action: RequestAction, remarks: string) => {
    const trimmedRemarks = remarks.trim();
    if (action.requiresRemarks && !trimmedRemarks) {
      setRemarksError("Admin remarks are required when rejecting a request.");
      return;
    }
    setFormError("");
    setRemarksError("");
    setStartRemarksError("");
    try {
      await update.mutateAsync({
        status: action.status,
        ...(trimmedRemarks ? { adminRemarks: trimmedRemarks } : {}),
      });
      toast(
        `Request #${item.id} is now ${presentRequestStatus(action.status, false).label}`,
      );
      setActiveAction(null);
      setDialogRemarks("");
      setStartRemarks("");
    } catch (error) {
      await handleUpdateError(
        error,
        action.label === "Start work" ? "start" : "dialog",
      );
    }
  };
  const applyRemarks = async () => {
    setRemarksOnlyError("");
    try {
      await update.mutateAsync({ adminRemarks: remarksDraft.trim() });
      toast(`Remarks updated for request #${item.id}`);
      setRemarksDraft("");
    } catch (error) {
      await handleUpdateError(error, "remarks");
    }
  };

  return (
    <>
      <PageHeader
        title={`Request #${item.id}: ${item.service.name}`}
        description="Request details and status history."
      />
      <Card className="request-detail-card">
        <div className="staff-request-person">
          <strong>{item.resident.fullName}</strong>
          <span>Flat {item.flatNumber}</span>
        </div>
        <div className="detail-badges">
          <StatusBadge status={item.status} overdue={item.overdue} />
        </div>
        <dl className="request-definition-list">
          <Detail label="Service">{item.service.name}</Detail>
          <Detail label="Description">
            <span className="preserve-lines">{item.description}</span>
          </Detail>
          <Detail label="Flat number">{item.flatNumber}</Detail>
          <Detail label="Request date">
            {formatDateOnly(item.requestDate)}
          </Detail>
          <Detail label="Expected completion date">
            {formatDateOnly(item.expectedCompletionDate)}
          </Detail>
          <Detail label="Status">
            {presentRequestStatus(item.status, false).label}
            {item.overdue ? " - Overdue" : ""}
          </Detail>
          <Detail label="Admin remarks">
            <span className="preserve-lines">
              {item.adminRemarks || "No remarks yet"}
            </span>
          </Detail>
          <Detail label="Created">{formatTimestamp(item.createdAt)}</Detail>
          <Detail label="Last updated">
            {formatTimestamp(item.updatedAt)}
          </Detail>
        </dl>
      </Card>
      <Card className="manage-request-card">
        <h2>Manage request</h2>
        {formError && <Alert tone="error">{formError}</Alert>}
        {actions.length === 0 ? (
          <p>This request is closed.</p>
        ) : (
          <div className="staff-action-list">
            {actions.map((action) =>
              !action.needsConfirmation ? (
                <div key={action.status} className="staff-inline-action">
                  <FormField
                    id="start-work-remarks"
                    label="Optional remarks"
                    error={startRemarksError || undefined}
                  >
                    <Textarea
                      maxLength={2000}
                      value={startRemarks}
                      onChange={(event) => {
                        setStartRemarks(
                          [...event.target.value].slice(0, 1000).join(""),
                        );
                        setStartRemarksError("");
                      }}
                    />
                    <span className="character-count">
                      {[...startRemarks].length}/1000
                    </span>
                  </FormField>
                  <Button
                    loading={update.isPending}
                    onClick={() => void applyStatus(action, startRemarks)}
                  >
                    {action.label}
                  </Button>
                </div>
              ) : (
                <Button
                  key={action.status}
                  variant={
                    action.status === REQUEST_STATUSES[3] ? "danger" : "primary"
                  }
                  disabled={update.isPending}
                  onClick={() => {
                    setActiveAction(action);
                    setDialogRemarks("");
                    setRemarksError("");
                    setFormError("");
                  }}
                >
                  {action.label}
                </Button>
              ),
            )}
          </div>
        )}
        {isOpen && (
          <form
            className="remarks-only-form"
            onSubmit={(event) => {
              event.preventDefault();
              void applyRemarks();
            }}
          >
            <h3>Update remarks</h3>
            <p>
              Changing remarks alone does not notify the resident or add a
              history entry.
            </p>
            <FormField
              id="remarks-only"
              label="Admin remarks"
              error={remarksOnlyError || undefined}
            >
              <Textarea
                maxLength={2000}
                value={remarksDraft}
                onChange={(event) =>
                  setRemarksDraft(
                    [...event.target.value].slice(0, 1000).join(""),
                  )
                }
              />
              <span className="character-count">
                {[...remarksDraft].length}/1000
              </span>
            </FormField>
            <Button
              type="submit"
              variant="secondary"
              loading={update.isPending}
            >
              Save remarks
            </Button>
          </form>
        )}
      </Card>
      <section className="request-history" aria-labelledby="history-title">
        <h2 id="history-title">Status history</h2>
        {(history.data?.length ?? 0) === 0 ? (
          <Card>
            <p>No status history is available.</p>
          </Card>
        ) : (
          <ol className="history-timeline">
            {history.data?.map((entry, index) => (
              <li key={`${entry.createdAt}-${index}`}>
                <Card>
                  <strong>
                    {entry.fromStatus === null
                      ? `Created as ${presentRequestStatus(entry.toStatus, false).label}`
                      : `From ${presentRequestStatus(entry.fromStatus, false).label} to ${presentRequestStatus(entry.toStatus, false).label}`}
                  </strong>
                  <p>Changed by {entry.changedBy.fullName}</p>
                  <time dateTime={entry.createdAt}>
                    {formatTimestamp(entry.createdAt)}
                  </time>
                  {entry.remarks && (
                    <p className="preserve-lines">{entry.remarks}</p>
                  )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
      <Dialog
        open={activeAction !== null}
        title={`${activeAction?.label ?? "Update"} request #${item.id}`}
        onClose={closeDialog}
      >
        {activeAction && (
          <>
            <p>
              Confirm that request #{item.id} will be marked{" "}
              {presentRequestStatus(
                activeAction.status,
                false,
              ).label.toLowerCase()}
              .
            </p>
            <FormField
              id="status-change-remarks"
              label="Admin remarks"
              hint={
                activeAction.requiresRemarks
                  ? "Required when rejecting a request."
                  : "Optional, up to 1000 characters."
              }
              error={remarksError || undefined}
              required={activeAction.requiresRemarks}
            >
              <Textarea
                maxLength={2000}
                value={dialogRemarks}
                onChange={(event) => {
                  setDialogRemarks(
                    [...event.target.value].slice(0, 1000).join(""),
                  );
                  setRemarksError("");
                }}
              />
              <span className="character-count">
                {[...dialogRemarks].length}/1000
              </span>
            </FormField>
            <div className="dialog-actions">
              <Button
                variant="secondary"
                disabled={update.isPending}
                onClick={closeDialog}
              >
                Cancel
              </Button>
              <Button
                variant={
                  activeAction.status === "REJECTED" ? "danger" : "primary"
                }
                loading={update.isPending}
                onClick={() => void applyStatus(activeAction, dialogRemarks)}
              >
                Confirm {activeAction.label.toLowerCase()}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
function NotFoundRequest() {
  return (
    <section className="standalone-page">
      <PageHeader
        title="Request not found"
        description="We could not find that request."
      />
      <Link className="button button-secondary" to="/admin/requests">
        Back to requests
      </Link>
    </section>
  );
}
