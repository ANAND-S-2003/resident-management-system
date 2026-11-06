import type { ReactNode } from "react";
import { notificationsLabel } from "./notifications-label";

/** Keeps visible notification text while exposing one deterministic accessible name. */
export function NotificationsLinkContent({
  count,
  children,
}: {
  count: number;
  children?: ReactNode;
}) {
  return (
    <>
      <span aria-hidden="true">Notifications</span>
      <span className="sr-only">{notificationsLabel(count)}</span>
      {children}
    </>
  );
}
