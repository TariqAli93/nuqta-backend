/**
 * Abstract base class for read (query) use-cases.
 *
 * Read use-cases are intentionally simple: a single execute() method that
 * returns data without any side-effects.  The base class exists to provide
 * a consistent interface and to make it easy to swap implementations
 * (e.g. for caching query handlers in the future).
 *
 * Generic parameters:
 *  TInput  — the filter / pagination parameters (use a typed Query Object
 *            from src/domain/shared/queries/ for list operations)
 *  TOutput — the returned data shape
 */
export abstract class ReadUseCase<TInput, TOutput> {
  abstract execute(input: TInput, userId: string): Promise<TOutput>;
}
