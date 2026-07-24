import { describe, expect, it } from 'vitest';

import {
  createPaginationMeta,
  PaginatedResult,
  SortOrder,
} from './pagination.js';

describe('createPaginationMeta', () => {
  it('calculates total pages and retains deterministic sort state', () => {
    expect(
      createPaginationMeta(
        { order: SortOrder.Desc, page: 2, pageSize: 25 },
        51,
        'startsAt',
      ),
    ).toEqual({
      order: 'desc',
      page: 2,
      pageSize: 25,
      sort: 'startsAt',
      totalItems: 51,
      totalPages: 3,
    });
  });

  it('returns zero pages for an empty collection', () => {
    expect(
      createPaginationMeta(
        { order: SortOrder.Asc, page: 1, pageSize: 25 },
        0,
        'name',
      ).totalPages,
    ).toBe(0);
  });

  it('carries collection items and metadata without persistence types', () => {
    const meta = createPaginationMeta(
      { order: SortOrder.Asc, page: 1, pageSize: 25 },
      1,
      'name',
    );

    expect(new PaginatedResult([{ id: 'fixture' }], meta)).toEqual({
      items: [{ id: 'fixture' }],
      meta,
    });
  });
});
