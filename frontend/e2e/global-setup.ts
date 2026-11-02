import type { FullConfig } from '@playwright/test';

export default function globalSetup(_config: FullConfig): void {
  if (!process.env.RMS_SUPERADMIN_EMAIL || !process.env.RMS_SUPERADMIN_PASSWORD) {
    throw new Error('RMS_SUPERADMIN_EMAIL and RMS_SUPERADMIN_PASSWORD are required. Load them with scripts/load-env.ps1 before running the E2E suite.');
  }
}
