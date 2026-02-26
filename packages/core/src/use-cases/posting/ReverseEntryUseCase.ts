import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { JournalEntry } from "../../entities/Accounting.js";
import { NotFoundError, InvalidStateError } from "../../errors/DomainErrors.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";

/**
 * ReverseEntryUseCase
 * Creates a reversing journal entry for a posted entry, or voids an unposted entry.
 *
 * Rules:
 * - Original entry must exist and not already be reversed
 * - Posted entries: locked posting batches cannot be reversed; creates a counter-entry
 * - Unposted entries: voided in place (marked isReversed=true, no counter-entry)
 */
export class ReverseEntryUseCase {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository,
  ) {}

  async execute(entryId: number, userId: number): Promise<JournalEntry> {
    const original = await this.getValidatedOriginalEntry(entryId);
    return await this.executeCommitPhase(original, userId);
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

  async executeCommitPhase(
    originalEntry: JournalEntry,
    userId: number,
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

    return await this.postingRepo.createReversalEntry(originalEntry.id, userId);
  }
}
