/**
 * Base marker interface for typed query objects (CQRS read-side).
 *
 * Concrete query objects carry all filter and pagination parameters as typed
 * fields instead of being passed as loose positional arguments to use-cases.
 * This makes call-sites self-documenting and allows route-level code to
 * construct a validated query object before delegating to the use-case.
 *
 * Usage:
 *   class GetSalesQuery implements Query<PaginatedResult<Sale>> {
 *     constructor(readonly status?: SaleStatus, readonly page: number = 1) {}
 *   }
 *
 * TResult — the type returned by the matching query handler.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export interface Query<TResult> {
  // Marker interface.  TResult is used only at the type level.
}

/**
 * Handler interface for a specific query type.
 *
 * Implementations live in the same use-case module as the query class.
 */
export interface IQueryHandler<TQuery extends Query<TResult>, TResult> {
  handle(query: TQuery): Promise<TResult>;
}
