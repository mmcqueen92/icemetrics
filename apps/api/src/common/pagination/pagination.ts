import type {
  PaginationMetaDto,
  PaginationQueryDto,
} from './pagination.dto.js';

export class PaginatedResult<T> {
  constructor(
    readonly items: readonly T[],
    readonly meta: PaginationMetaDto,
  ) {}
}

export { SortOrder } from './pagination.dto.js';

export function createPaginationMeta(
  query: Pick<PaginationQueryDto, 'order' | 'page' | 'pageSize'>,
  totalItems: number,
  sort: string,
): PaginationMetaDto {
  return {
    order: query.order,
    page: query.page,
    pageSize: query.pageSize,
    sort,
    totalItems,
    totalPages: Math.ceil(totalItems / query.pageSize),
  };
}
