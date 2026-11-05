/** Builds the exact accessible name shared by notification links and cards. */
export function notificationsLabel(count: number): string {
  return count > 0 ? `Notifications, ${count} unread` : 'Notifications';
}
