import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { JournalEntry } from "../../entities/Accounting.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

/**
 * ReverseEntryUseCase
 * Creates a reversing journal entry for a posted entry, or voids an unposted entry.
 *
 * Rules:
 * - Original entry must exist and not already be reversed
 * - Posted entries: locked posting batches cannot be reversed; creates a counter-entry
 * - Unposted entries: voided in place (marked isReversed=true, no counter-entry)
 */
export class ReverseEntryUseCase extends WriteUseCase<number, JournalEntry, JournalEntry> {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository,
    private auditRepo?: IAuditRepository,
  ) {
    super();
  }

  async executeCommitPhase(entryId: number, _userId: string): Promise<JournalEntry> {
    const original = await this.getValidatedOriginalEntry(entryId);
    return await this.performReversal(original, _userId);
  }

  async getValidatedOriginalEntry(entryId: number): Promise<JournalEntry> {
    const original = await this.accountingRepo.getEntryById(entryId);
    if (!original) {
      throw new NotFoundError("Journal entry not found", { entryId });
    }

    if (!original.id) {
      throw new InvalidStateError("Journal entry id is missing", { entryId });
    }

    if (original.isReversed) {
      throw new InvalidStateError("Entry is already reversed", { entryId });
    }

    // Enforce lock only for posted entries with a batch
    if (original.isPosted && original.postingBatchId) {
      const isLocked = await this.postingRepo.isBatchLocked(
        original.postingBatchId,
      );
      if (isLocked) {
        throw new InvalidStateError(
          "Cannot reverse entry in a locked posting batch",
          {
            entryId,
            postingBatchId: original.postingBatchId,
          },
        );
      }
    }

    return original;
  }

  async performReversal(
    originalEntry: JournalEntry,
    _userId: string,
  ): Promise<JournalEntry> {
    if (!originalEntry.id) {
      throw new InvalidStateError("Journal entry id is missing", {
        entryId: originalEntry.id,
      });
    }

    // Unposted entries: void in place (no counter-entry)
    if (!originalEntry.isPosted) {
      await this.postingRepo.voidUnpostedEntry(originalEntry.id);
      return { ...originalEntry, isReversed: true };
    }

    // Posted entries: enforce lock and create counter-entry
    if (originalEntry.postingBatchId) {
      const isLocked = await this.postingRepo.isBatchLocked(
        originalEntry.postingBatchId,
      );
      if (isLocked) {
        throw new InvalidStateError(
          "Cannot reverse entry in a locked posting batch",
          {
            entryId: originalEntry.id,
            postingBatchId: originalEntry.postingBatchId,
          },
        );
      }
    }

    return await this.postingRepo.createReversalEntry(originalEntry.id, Number(_userId) || 0);
  }

  async executeSideEffectsPhase(result: JournalEntry, userId: string): Promise<void> {
    if (!this.auditRepo) return;
    try {
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId),
          action: "posting:entry:reverse",
          entityType: "JournalEntry",
          entityId: result.id!,
          timestamp: new Date().toISOString(),
          changeDescription: `عكس قيد يومي رقم ${result.entryNumber ?? result.id}`,
          metadata: {
            reversalEntryId: result.id,
            reversalEntryNumber: result.entryNumber,
            originalEntryId: result.reversalOfId ?? null,
            wasPosted: result.isPosted,
          },
        }),
      );
    } catch {
      // Audit must not break committed reversal.
    }
  }

  toEntity(result: JournalEntry): JournalEntry {
    return result;
  }
}
