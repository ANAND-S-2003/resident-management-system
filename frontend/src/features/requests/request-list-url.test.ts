import { describe, expect, it } from 'vitest';
import { parseStaffRequestListState, updateStaffRequestSearch } from './request-list-url';

describe('staff request URL state', () => {
  it('sanitizes unknown parameters and clamps pagination', () => {
    expect(parseStaffRequestListState(new URLSearchParams('status=OTHER&overdue=yes&page=-5&size=1000&sort=id,asc&q=%20%20'))).toEqual({ overdue: false, q: '', page: 0, size: 100, sort: 'createdAt,desc' });
    expect(parseStaffRequestListState(new URLSearchParams('size='))).toMatchObject({ size: 20 });
    expect(parseStaffRequestListState(new URLSearchParams('status=PENDING&page=2&size=0&sort=status,asc&q=%20room%20'))).toEqual({ status: 'PENDING', overdue: false, q: 'room', page: 2, size: 1, sort: 'status,asc' });
  });

  it('writes filters and resets the page unless it is explicitly retained', () => {
    const current = new URLSearchParams('page=4&status=PENDING');
    expect(updateStaffRequestSearch(current, { q: 'unit 42', status: null }).toString()).toBe('q=unit+42');
    expect(updateStaffRequestSearch(current, { page: '5' }, false).toString()).toBe('page=5&status=PENDING');
  });
});
