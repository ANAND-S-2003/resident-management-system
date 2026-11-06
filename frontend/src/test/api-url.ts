import { API_BASE_PATH } from "../lib/api/config";

export const TEST_API_ORIGIN = "http://localhost";
export const TEST_API_BASE_URL = `${TEST_API_ORIGIN}${API_BASE_PATH}`;
export const testApiUrl = (path: string): string =>
  `${TEST_API_BASE_URL}${path}`;
