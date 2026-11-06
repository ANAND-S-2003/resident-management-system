import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Pagination,
  Skeleton,
  Textarea,
  useToast,
} from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { friendlyErrorMessage } from "@/lib/api/friendly-errors";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import {
  useCreateService,
  useServicesAdmin,
  useSetServiceActive,
  useUpdateService,
} from "./hooks";
import { ActivationBadge, ListToolbar } from "./components";
import { serviceFormSchema } from "./schemas";
import type { Service } from "@/lib/api/types";

const SERVICE_SORTS = [
  "name,asc",
  "name,desc",
  "createdAt,asc",
  "createdAt,desc",
] as const;
function stateFrom(search: URLSearchParams) {
  const page = Number(search.get("page"));
  const size = Number(search.get("size"));
  const rawSize = search.get("size");
  const sort = search.get("sort");
  const active = search.get("active");
  return {
    q: [...(search.get("q") ?? "").trim()].slice(0, 100).join(""),
    page: Number.isSafeInteger(page) && page >= 0 ? page : 0,
    size:
      rawSize === null
        ? 20
        : Number.isInteger(size)
          ? Math.min(100, Math.max(1, size))
          : 20,
    sort: (SERVICE_SORTS as readonly string[]).includes(sort ?? "")
      ? sort!
      : "name,asc",
    active: active === "true" || active === "false" ? active : "",
  };
}

export function ServicesPage() {
  useDocumentTitle("Services");
  const [search, setSearch] = useSearchParams();
  const state = stateFrom(search);
  const params = {
    ...(state.q ? { q: state.q } : {}),
    ...(state.active ? { active: state.active === "true" } : {}),
    page: state.page,
    size: state.size,
    sort: state.sort,
  };
  const services = useServicesAdmin(params);
  const create = useCreateService();
  const toast = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [activationId, setActivationId] = useState<number | null>(null);
  const records = services.data?.content ?? [];
  const editing = records.find((item) => item.id === editingId);
  const activating = records.find((item) => item.id === activationId);
  const updateSearch = (
    changes: Record<string, string | null>,
    reset = true,
  ) => {
    const next = new URLSearchParams(search);
    Object.entries(changes).forEach(([key, value]) =>
      value ? next.set(key, value) : next.delete(key),
    );
    if (reset) next.delete("page");
    setSearch(next);
  };
  if (services.isLoading)
    return (
      <>
        <PageHeader title="Services" />
        <Skeleton className="list-skeleton" />
        <Skeleton className="list-skeleton" />
      </>
    );
  if (services.isError)
    return (
      <>
        <PageHeader title="Services" />
        <ErrorState
          error={services.error}
          onRetry={() => void services.refetch()}
        />
      </>
    );
  return (
    <>
      <PageHeader
        title="Services"
        description="Manage services residents can request."
        actions={
          <Button onClick={() => setCreateOpen(true)}>Add service</Button>
        }
      />
      <Card>
        <ListToolbar
          query={state.q}
          onQuery={(q) => updateSearch({ q: q || null })}
          placeholder="Search service names"
          onClear={() => setSearch(new URLSearchParams())}
        >
          <FormField id="service-active-filter" label="Status">
            <select
              className="control"
              value={state.active}
              onChange={(event) =>
                updateSearch({ active: event.target.value || null })
              }
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
          </FormField>
          <FormField id="service-sort-filter" label="Sort">
            <select
              className="control"
              value={state.sort}
              onChange={(event) => updateSearch({ sort: event.target.value })}
            >
              {SERVICE_SORTS.map((value) => (
                <option key={value} value={value}>
                  {value.replace(",", " ")}
                </option>
              ))}
            </select>
          </FormField>
          <FormField id="service-size-filter" label="Page size">
            <select
              className="control"
              value={state.size}
              onChange={(event) => updateSearch({ size: event.target.value })}
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </FormField>
        </ListToolbar>
      </Card>
      {records.length === 0 ? (
        <Card>
          <EmptyState
            title={
              state.q || state.active
                ? "No services match these filters"
                : "No services yet"
            }
          >
            Add a service or adjust the filters.
          </EmptyState>
        </Card>
      ) : (
        <>
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((service) => (
                  <tr key={service.id}>
                    <td>{service.name}</td>
                    <td className="truncate-cell">
                      {service.description || "No description"}
                    </td>
                    <td>
                      <ActivationBadge active={service.active} />
                    </td>
                    <td className="management-actions">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setEditingId(service.id)}
                      >
                        Edit
                      </Button>
                      <ServiceActivationButton
                        service={service}
                        onDeactivate={() => setActivationId(service.id)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="management-cards">
            {records.map((service) => (
              <Card className="management-card" key={service.id}>
                <h2>{service.name}</h2>
                <p>{service.description || "No description"}</p>
                <ActivationBadge active={service.active} />
                <div className="management-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setEditingId(service.id)}
                  >
                    Edit
                  </Button>
                  <ServiceActivationButton
                    service={service}
                    onDeactivate={() => setActivationId(service.id)}
                  />
                </div>
              </Card>
            ))}
          </div>
          <Pagination
            page={state.page}
            size={state.size}
            totalElements={services.data?.totalElements ?? 0}
            onPageChange={(page) => updateSearch({ page: String(page) }, false)}
            onSizeChange={(size) => updateSearch({ size: String(size) })}
          />
        </>
      )}
      {createOpen && (
        <ServiceDialog
          open
          onClose={() => setCreateOpen(false)}
          title="Add service"
          busy={create.isPending}
          onSave={async (body) => {
            await create.mutateAsync(body);
            toast("Service created successfully.");
            setCreateOpen(false);
          }}
        />
      )}
      {editing && (
        <ServiceEditDialog
          key={editing.id}
          service={editing}
          onClose={() => setEditingId(null)}
        />
      )}
      {activating?.active && (
        <ServiceActivationDialog
          service={activating}
          onClose={() => setActivationId(null)}
        />
      )}
    </>
  );
}

function ServiceEditDialog({
  service,
  onClose,
}: {
  service: Service;
  onClose: () => void;
}) {
  const mutation = useUpdateService(service.id);
  const toast = useToast();
  return (
    <ServiceDialog
      open
      title="Edit service"
      initial={service}
      onClose={onClose}
      onSave={async (body) => {
        await mutation.mutateAsync(body);
        toast("Service updated successfully.");
        onClose();
      }}
      busy={mutation.isPending}
    />
  );
}

function ServiceDialog({
  open,
  title,
  initial,
  onClose,
  onSave,
  busy = false,
}: {
  open: boolean;
  title: string;
  initial?: Service;
  onClose: () => void;
  onSave: (body: { name: string; description: string }) => Promise<void>;
  busy?: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setErrors({});
    setFormError("");
    const parsed = serviceFormSchema.safeParse({ name, description });
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setSaving(true);
    try {
      await onSave(parsed.data);
    } catch (error) {
      if (error instanceof ApiError && error.code === "DUPLICATE_RESOURCE")
        setErrors({ name: "A service with this name already exists." });
      else if (error instanceof ApiError && error.details.length)
        setErrors(
          Object.fromEntries(
            error.details.map((item) => [item.field, item.message]),
          ),
        );
      else setFormError(friendlyErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={open} title={title} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        {formError && <Alert tone="error">{formError}</Alert>}
        <FormField id="service-name" label="Name" required error={errors.name}>
          <Input
            maxLength={200}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField
          id="service-description"
          label="Description"
          error={errors.description}
        >
          <Textarea
            maxLength={1000}
            rows={4}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <span className="character-count">{[...description].length}/500</span>
        </FormField>
        <div className="dialog-actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={saving || busy}>
            {initial ? "Save changes" : "Create service"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function ServiceActivationDialog({
  service,
  onClose,
}: {
  service: Service;
  onClose: () => void;
}) {
  const mutation = useSetServiceActive(service.id);
  const toast = useToast();
  const [error, setError] = useState("");
  const deactivate = service.active;
  const change = async () => {
    setError("");
    try {
      await mutation.mutateAsync({ active: !deactivate });
      toast(`Service ${deactivate ? "deactivated" : "reactivated"}.`);
      onClose();
    } catch (cause) {
      setError(friendlyErrorMessage(cause));
    }
  };
  return (
    <Dialog
      open
      title={`${deactivate ? "Deactivate" : "Reactivate"} service`}
      onClose={onClose}
    >
      <p>
        {deactivate
          ? "Residents can no longer choose this service for new requests. Existing requests keep it."
          : `Reactivate ${service.name}?`}
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      <div className="dialog-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          variant={deactivate ? "danger" : "primary"}
          loading={mutation.isPending}
          onClick={() => void change()}
        >
          {deactivate ? "Deactivate" : "Reactivate"}
        </Button>
      </div>
    </Dialog>
  );
}

function ServiceActivationButton({
  service,
  onDeactivate,
}: {
  service: Service;
  onDeactivate: () => void;
}) {
  const mutation = useSetServiceActive(service.id);
  const toast = useToast();
  const reactivate = () =>
    mutation.mutate(
      { active: true },
      {
        onSuccess: () => toast("Service reactivated."),
        onError: (error) => toast(friendlyErrorMessage(error), "error"),
      },
    );
  return (
    <Button
      variant={service.active ? "danger" : "secondary"}
      size="sm"
      loading={mutation.isPending}
      onClick={service.active ? onDeactivate : reactivate}
    >
      {service.active ? "Deactivate" : "Reactivate"}
    </Button>
  );
}
