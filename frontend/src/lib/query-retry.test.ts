import { describe, expect, it } from 'vitest';
import { ApiError } from './api/client';
import { shouldRetryQuery } from './query-retry';

describe('query retry policy', () => {
  it.each([400, 401, 403, 404, 409, 429])('does not retry client status %s', (status) => {
    expect(shouldRetryQuery(0, new ApiError(status, 'UNKNOWN', 'safe'))).toBe(false);
  });

  it('retries a transient failure once and then stops', () => {
    expect(shouldRetryQuery(0, new ApiError(500, 'INTERNAL_ERROR', 'safe'))).toBe(true);
    expect(shouldRetryQuery(1, new ApiError(500, 'INTERNAL_ERROR', 'safe'))).toBe(false);
    expect(shouldRetryQuery(0, new Error('network'))).toBe(true);
  });
});
