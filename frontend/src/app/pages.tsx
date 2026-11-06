import { Link } from "react-router-dom";
import { Alert, Button, PageHeader } from "@/components/ui";
import { branding } from "@/config/branding";
import { useDocumentTitle } from "@/lib/useDocumentTitle";

export function ForbiddenPage() {
  useDocumentTitle("Access denied");
  return (
    <main className="standalone-page">
      <PageHeader
        title="Access denied"
        description="You do not have permission to view this page."
      />
      <Alert tone="warning">
        If you believe you should have access, contact your community
        administrator.
      </Alert>
      <Link to="/">Return to your home page</Link>
    </main>
  );
}
export function NotFoundPage() {
  useDocumentTitle("Page not found");
  return (
    <main className="standalone-page">
      <PageHeader
        title="Page not found"
        description="The page you requested could not be found."
      />
      <Link to="/">Return to your home page</Link>
    </main>
  );
}
export function RootErrorFallback() {
  useDocumentTitle("Something went wrong");
  return (
    <main className="standalone-page">
      <PageHeader
        title="Something went wrong"
        description={`We could not load ${branding.shortName}.`}
      />
      <Button onClick={() => window.location.reload()}>Reload page</Button>
    </main>
  );
}
