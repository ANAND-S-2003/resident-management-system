import { useEffect, useState, type ReactNode } from "react";
import { Badge, Button, FormField, Input } from "@/components/ui";

export function ActivationBadge({ active }: { active: boolean }) {
  return (
    <Badge tone={active ? "success" : "neutral"}>
      {active ? "Active" : "Inactive"}
    </Badge>
  );
}

export function ListToolbar({
  query,
  onQuery,
  placeholder,
  children,
  onClear,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  children?: ReactNode;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(query);
  useEffect(() => setDraft(query), [query]);
  useEffect(() => {
    if (draft === query) return;
    const timer = window.setTimeout(
      () => onQuery([...draft.trim()].slice(0, 100).join("")),
      400,
    );
    return () => window.clearTimeout(timer);
  }, [draft, onQuery, query]);
  return (
    <div className="list-toolbar">
      <FormField id="management-search" label="Search">
        <Input
          value={draft}
          maxLength={200}
          placeholder={placeholder}
          onChange={(event) =>
            setDraft([...event.target.value].slice(0, 100).join(""))
          }
        />
      </FormField>
      {children}
      <Button
        variant="secondary"
        onClick={() => {
          setDraft("");
          onQuery("");
          onClear();
        }}
      >
        Clear filters
      </Button>
    </div>
  );
}

export function ApiFormError({ message }: { message: string }) {
  return (
    <p className="form-error-summary" role="alert">
      {message}
    </p>
  );
}

export function ErrorMessage({ message }: { message: string }) {
  return <span>{message}</span>;
}
