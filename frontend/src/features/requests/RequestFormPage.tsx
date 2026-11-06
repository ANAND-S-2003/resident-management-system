import { useEffect, useMemo, useState } from "react";
import { Link, useBlocker, useNavigate } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FormField,
  Input,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import {
  apiFieldErrors,
  friendlyErrorMessage,
} from "@/lib/api/friendly-errors";
import { ApiError } from "@/lib/api/client";
import { codePointLength } from "@/lib/validation/schemas";
import { getApplicationToday } from "@/lib/dates";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useCreateRequest, useServices } from "./hooks";
import {
  requestFormSchema,
  type RequestFormValues,
} from "./request-form-schema";
import { ConfirmDialog } from "@/components/ui";

export function RequestFormPage() {
  useDocumentTitle("New service request");
  const { user } = useAuth();
  const today = getApplicationToday();
  const navigate = useNavigate();
  const toast = useToast();
  const serviceQuery = useServices({
    active: true,
    page: 0,
    size: 100,
    sort: "name,asc",
  });
  const createRequest = useCreateRequest();
  const schema = useMemo(() => requestFormSchema(today), [today]);
  const form = useForm<RequestFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      serviceId: "",
      description: "",
      expectedCompletionDate: "",
    },
  });
  const [allowLeave, setAllowLeave] = useState(false);
  const [createdRequestId, setCreatedRequestId] = useState<number | null>(null);
  const isDirty =
    form.formState.isDirty && !allowLeave && !createRequest.isSuccess;
  const blocker = useBlocker(isDirty);

  useEffect(() => {
    if (!allowLeave || createdRequestId === null) return;
    navigate(
      `/resident/requests/${encodeURIComponent(String(createdRequestId))}`,
    );
  }, [allowLeave, createdRequestId, navigate]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const created = await createRequest.mutateAsync({
        serviceId: Number(values.serviceId),
        description: values.description,
        expectedCompletionDate: values.expectedCompletionDate,
      });
      toast("Request created successfully.");
      setCreatedRequestId(created.id);
      setAllowLeave(true);
    } catch (error) {
      const fields = apiFieldErrors(error);
      for (const [field, message] of Object.entries(fields)) {
        if (
          field === "description" ||
          field === "expectedCompletionDate" ||
          field === "serviceId"
        )
          form.setError(field, { message });
      }
      if (error instanceof ApiError && error.status === 404) {
        await serviceQuery.refetch();
        form.setError("serviceId", {
          message:
            "That service is no longer available. Choose an active service.",
        });
      } else if (!Object.keys(fields).length)
        form.setError("root.server", { message: friendlyErrorMessage(error) });
    }
  });

  if (serviceQuery.isLoading)
    return (
      <>
        <PageHeader title="New request" />
        <Card>
          <p>Flat number: {user?.flatNumber ?? "Not set"}</p>
          <div className="form-skeleton">
            <span />
            <span />
            <span />
          </div>
        </Card>
      </>
    );
  if (serviceQuery.isError)
    return (
      <>
        <PageHeader title="New request" />
        <ErrorState
          error={serviceQuery.error}
          onRetry={() => void serviceQuery.refetch()}
        />
      </>
    );
  const services = serviceQuery.data?.content ?? [];
  if (!services.length)
    return (
      <>
        <PageHeader title="New request" />
        <Card>
          <p>Flat number: {user?.flatNumber ?? "Not set"}</p>
          <EmptyState title="No active services are available">
            <Link to="/resident">Return to your dashboard</Link>
          </EmptyState>
        </Card>
      </>
    );

  const selectedService = services.find(
    (service) => String(service.id) === form.watch("serviceId"),
  );
  return (
    <>
      <PageHeader
        title="New request"
        description="Tell us what needs attention and when you expect it to be completed."
      />
      <Card>
        {form.formState.errors.root?.server?.message && (
          <Alert tone="error">
            {form.formState.errors.root.server.message}
          </Alert>
        )}
        <p className="readonly-field">
          <strong>Flat number</strong>
          <span>{user?.flatNumber ?? "Not set"}</span>
        </p>
        <form onSubmit={onSubmit} noValidate>
          <fieldset
            disabled={createRequest.isPending}
            className="request-form-fields"
          >
            <FormField
              id="serviceId"
              label="Service"
              required
              error={form.formState.errors.serviceId?.message}
            >
              <Select id="serviceId" {...form.register("serviceId")}>
                <option value="">Choose a service</option>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </Select>
            </FormField>
            {selectedService?.description && (
              <p className="field-hint service-description">
                {selectedService.description}
              </p>
            )}
            <FormField
              id="description"
              label="Description"
              hint="Describe the issue in 5 to 1000 characters."
              required
              error={form.formState.errors.description?.message}
            >
              <Textarea
                id="description"
                rows={5}
                {...form.register("description")}
              />
            </FormField>
            <p className="character-count" aria-live="polite">
              {codePointLength(form.watch("description") ?? "")} / 1000
              characters
            </p>
            <FormField
              id="expectedCompletionDate"
              label="Expected completion date"
              required
              error={form.formState.errors.expectedCompletionDate?.message}
            >
              <Input
                id="expectedCompletionDate"
                type="date"
                min={today}
                {...form.register("expectedCompletionDate")}
              />
            </FormField>
          </fieldset>
          <div className="form-actions">
            <Button type="submit" loading={createRequest.isPending}>
              Submit request
            </Button>
            <Link to="/resident/requests">Cancel</Link>
          </div>
        </form>
      </Card>
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Discard your request?"
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
      >
        Your changes have not been submitted. Leave this page and discard them?
      </ConfirmDialog>
    </>
  );
}
