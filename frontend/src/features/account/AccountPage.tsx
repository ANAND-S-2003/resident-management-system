import { useState } from "react";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Alert,
  Button,
  Card,
  FormField,
  Input,
  PageHeader,
  useToast,
} from "@/components/ui";
import { useAuth } from "@/features/auth/AuthProvider";
import { ApiError } from "@/lib/api/client";
import {
  apiFieldErrors,
  friendlyErrorMessage,
} from "@/lib/api/friendly-errors";
import { passwordSchema } from "@/lib/validation/schemas";
import { useDocumentTitle } from "@/lib/useDocumentTitle";
import { useChangePassword } from "@/features/requests/hooks";
import { ROLES } from "@/lib/constants";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, context) => {
    if (value.newPassword === value.currentPassword)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Choose a new password that differs from your current password.",
        path: ["newPassword"],
      });
    if (value.newPassword !== value.confirmPassword)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Passwords do not match.",
        path: ["confirmPassword"],
      });
  });
type PasswordFields = z.infer<typeof changePasswordSchema>;

export function AccountPage() {
  useDocumentTitle("Account");
  const { user } = useAuth();
  const toast = useToast();
  const changePassword = useChangePassword();
  const [visible, setVisible] = useState({
    current: false,
    next: false,
    confirm: false,
  });
  const form = useForm<PasswordFields>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });
  const submit = form.handleSubmit(async ({ currentPassword, newPassword }) => {
    try {
      await changePassword.mutateAsync({ currentPassword, newPassword });
      form.reset();
      toast("Password changed successfully. You are still signed in.");
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.code === "INVALID_CURRENT_PASSWORD"
      )
        form.setError("currentPassword", {
          message: "Current password is incorrect.",
        });
      else {
        const details = apiFieldErrors(error);
        for (const [field, message] of Object.entries(details))
          if (field === "currentPassword" || field === "newPassword")
            form.setError(field, { message });
        if (!Object.keys(details).length)
          form.setError("root.server", {
            message: friendlyErrorMessage(error),
          });
      }
    }
  });
  return (
    <>
      <PageHeader
        title="Account"
        description="Your profile and password settings."
      />
      <Card className="account-profile">
        <h2>Profile</h2>
        <dl className="request-definition-list">
          <div>
            <dt>Full name</dt>
            <dd>{user?.fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user?.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>
              {user?.role === ROLES[2]
                ? "Super admin"
                : user?.role === ROLES[1]
                  ? "Admin"
                  : "Resident"}
            </dd>
          </div>
          {user?.role === ROLES[0] && (
            <div>
              <dt>Flat number</dt>
              <dd>{user?.flatNumber}</dd>
            </div>
          )}
        </dl>
      </Card>
      <Card className="change-password-card">
        <h2>Change password</h2>
        {form.formState.errors.root?.server?.message && (
          <Alert tone="error">
            {form.formState.errors.root.server.message}
          </Alert>
        )}
        <form onSubmit={submit} noValidate>
          <PasswordField
            id="currentPassword"
            label="Current password"
            autoComplete="current-password"
            visible={visible.current}
            error={form.formState.errors.currentPassword?.message}
            onToggle={() =>
              setVisible((state) => ({ ...state, current: !state.current }))
            }
            register={form.register("currentPassword")}
          />
          <PasswordField
            id="newPassword"
            label="New password"
            autoComplete="new-password"
            visible={visible.next}
            error={form.formState.errors.newPassword?.message}
            onToggle={() =>
              setVisible((state) => ({ ...state, next: !state.next }))
            }
            register={form.register("newPassword")}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm new password"
            autoComplete="new-password"
            visible={visible.confirm}
            error={form.formState.errors.confirmPassword?.message}
            onToggle={() =>
              setVisible((state) => ({ ...state, confirm: !state.confirm }))
            }
            register={form.register("confirmPassword")}
          />
          <Button type="submit" loading={changePassword.isPending}>
            Change password
          </Button>
        </form>
      </Card>
    </>
  );
}

function PasswordField({
  id,
  label,
  autoComplete,
  visible,
  error,
  onToggle,
  register,
}: {
  id: string;
  label: string;
  autoComplete: string;
  visible: boolean;
  error?: string;
  onToggle: () => void;
  register: ReturnType<ReturnType<typeof useForm<PasswordFields>>["register"]>;
}) {
  return (
    <FormField id={id} label={label} required error={error}>
      <div className="password-control">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          {...register}
        />
        <button type="button" className="password-toggle" onClick={onToggle}>
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </FormField>
  );
}
