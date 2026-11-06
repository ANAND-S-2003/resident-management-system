import { useEffect } from "react";
import { branding } from "@/config/branding";

export function useDocumentTitle(pageTitle: string): void {
  useEffect(() => {
    document.title = `${pageTitle} | ${branding.shortName}`;
  }, [pageTitle]);
}
