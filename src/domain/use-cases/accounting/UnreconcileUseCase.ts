/**
 * UnreconcileUseCase
 *
 * Reverses a previously created reconciliation:
 *  1. Load the reconciliation and its lines.
 *  2. Collect the journal line IDs that were reconciled.
 *  3. Mark those journal lines as unreconciled (reconciled = false, reconciliation_id = null).
 *  4. Delete the reconciliation lines and the reconciliation header.
 *
 * Audit-safe: a hard delete is intentionally used here because the journal entries
 * themselves remain immutable.  The audit log records the reversal event.
 * For complete audit trails the caller should create a manual journal entry
 * reversing the original entries if needed (handled separately by ReverseEntryUseCase).
 */

import type { IReconciliationRepository } from "../../interfaces/IReconciliationRepository.js";
import type { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import type { UnreconcileInput } from "../../entities/Reconciliation.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";
import { AuditService } from "../../shared/services/AuditService.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

interface UnreconcileCommitResult {
  reconciliationId: number;
  releasedLineIds: number[];
}

export class UnreconcileUseCase extends WriteUseCase<
  UnreconcileInput,
  UnreconcileCommitResult,
  { ok: true; reconciliationId: number; releasedLineCount: number }
> {
  private auditService?: AuditService;

  constructor(
    private reconRepo: IReconciliationRepository,
    auditRepo?: IAuditRepository,
  ) {
    super();
    if (auditRepo) this.auditService = new AuditService(auditRepo);
  }

  async executeCommitPhase(
    input: UnreconcileInput,
    _userId: string,
  ): Promise<UnreconcileCommitResult> {
    // Prefer to run the unreconcile logic inside a single DB transaction
    // if the repository implementation provides a transactional helper.
    const repoAny = this.reconRepo as any;
    if (typeof repoAny.withTransaction === "function") {
      return await repoAny.withTransaction(
        async (txRepo: IReconciliationRepository) =>
          this.unreconcileInternal(txRepo, input),
      );
    }

    // Fallback to non-transactional behavior (existing behavior) when
    // the repository does not expose a transaction helper.
    return await this.unreconcileInternal(this.reconRepo, input);
  }

  /**
   * Core unreconcile logic. This method assumes that the provided repository
   * is already scoped to an appropriate transaction when needed.
   */
  private async unreconcileInternal(
    repo: IReconciliationRepository,
    input: UnreconcileInput,
  ): Promise<UnreconcileCommitResult> {
    // ── 1. Load the reconciliation ────────────────────────────────────────
    const reconciliation = await repo.findReconciliationById(
      input.reconciliationId,
    );
    if (!reconciliation) {
      throw new NotFoundError("Reconciliation not found", {
        reconciliationId: input.reconciliationId,
      });
    }

    const lines = reconciliation.lines ?? [];
    if (lines.length === 0) {
      throw new InvalidStateError(
        "Reconciliation has no lines — cannot unreconcile",
        { reconciliationId: input.reconciliationId },
      );
    }

    // ── 2. Collect journal line IDs ───────────────────────────────────────
    const journalLineIds = lines.map((l) => l.journalEntryLineId);

    // ── 3. Release the journal lines ──────────────────────────────────────
    await repo.markLinesUnreconciled(journalLineIds);

    // ── 4. Delete reconciliation detail + header ──────────────────────────
    await repo.deleteReconciliationLines(input.reconciliationId);
    await repo.deleteReconciliation(input.reconciliationId);

    return {
      reconciliationId: input.reconciliationId,
      releasedLineIds: journalLineIds,
    };
  }

  async executeSideEffectsPhase(
    result: UnreconcileCommitResult,
    userId: string,
  ): Promise<void> {
    if (!this.auditService) return;
    try {
      await this.auditService.logAction(
        Number(userId) || 0,
        "accounting:unreconcile",
        "Reconciliation",
        result.reconciliationId,
        `Reconciliation #${result.reconciliationId} reversed; released ${result.releasedLineIds.length} journal line(s)`,
        {
          reconciliationId: result.reconciliationId,
          releasedLineIds: result.releasedLineIds,
        },
      );
    } catch (err) {
      console.warn("[UnreconcileUseCase] Audit logging failed:", err);
    }
  }

  toEntity(result: UnreconcileCommitResult) {
    return {
      ok: true as const,
      reconciliationId: result.reconciliationId,
      releasedLineCount: result.releasedLineIds.length,
    };
  }
}
