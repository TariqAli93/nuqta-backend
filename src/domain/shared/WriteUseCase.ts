/**
 * Abstract base class for write (command) use-cases.
 *
 * Enforces the two-phase commit pattern:
 *  1. executeCommitPhase  — runs inside the DB transaction; must be atomic.
 *  2. executeSideEffectsPhase — runs after the commit; used for audit logging,
 *     domain-event publishing, SSE notifications, etc.
 *
 * Side-effect failures are caught and logged but do NOT roll back the commit.
 * This matches the existing behaviour in CreateSaleUseCase, AddPaymentUseCase,
 * CreatePurchaseUseCase, and AddPurchasePaymentUseCase.
 *
 * Generic parameters:
 *  TInput        — the input DTO passed to execute()
 *  TCommitResult — the intermediate result produced by executeCommitPhase()
 *  TEntity       — the public entity returned by execute()
 */
export abstract class WriteUseCase<TInput, TCommitResult, TEntity> {
  /**
   * Phase 1: All database writes that must succeed atomically.
   * Throwing here aborts the operation entirely.
   */
  abstract executeCommitPhase(
    input: TInput,
    userId: string,
  ): Promise<TCommitResult>;

  /**
   * Phase 2: Non-transactional side-effects (audit logs, domain events, etc.).
   * Failures here are logged but do NOT propagate to the caller.
   */
  abstract executeSideEffectsPhase(
    result: TCommitResult,
    userId: string,
  ): Promise<void>;

  /**
   * Maps the raw commit result to the public entity shape returned by execute().
   * For simple use-cases where TCommitResult === TEntity, return the value as-is.
   */
  abstract toEntity(result: TCommitResult): TEntity;

  /**
   * Orchestrates the two phases.  Callers only invoke this method.
   */
  async execute(input: TInput, userId: string): Promise<TEntity> {
    const result = await this.executeCommitPhase(input, userId);
    try {
      await this.executeSideEffectsPhase(result, userId);
    } catch (error) {
      // Side-effect failure must never roll back the committed data.
      console.error(`[SideEffect Error] ${this.constructor.name}:`, error);
    }
    return this.toEntity(result);
  }
}
