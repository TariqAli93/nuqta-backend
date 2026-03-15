/**
 * Standard wrapper for paginated list results.
 *
 * Used by all list-style use-cases / query handlers so that the pagination
 * envelope is consistent across the API.
 */
export interface PaginatedResult<T> {
  /** The items on the current page. */
  data: T[];
  /** Total count of items matching the query (ignoring pagination). */
  total: number;
  /** 1-based current page index. */
  page: number;
  /** Maximum items per page. */
  pageSize: number;
}

/**
 * Convenience builder for constructing a PaginatedResult.
 */
export function paginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return { data, total, page, pageSize };
}
