import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { JournalEntry } from "../../entities/Accounting.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { entryId: number };

export class UnpostIndividualEntryUseCase extends WriteUseCase<TInput, JournalEntry, JournalEntry> {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository,
    private auditRepo?: IAuditRepository,
  ) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<JournalEntry> {
    const entry = await this.accountingRepo.getEntryById(input.entryId);

    if (!entry) {
      throw new NotFoundError(`Journal entry ${input.entryId} not found`, { entryId: input.entryId });
    }

    if (!entry.isPosted) {
      throw new InvalidStateError(`Journal entry ${input.entryId} is not posted`, { entryId: input.entryId });
    }

    if (entry.postingBatchId) {
      const isLocked = await this.postingRepo.isBatchLocked(
        entry.postingBatchId,
      );
      if (isLocked) {
        throw new InvalidStateError(
          `Cannot unpost entry in a locked posting batch`,
          { entryId: input.entryId, postingBatchId: entry.postingBatchId },
        );
      }
    }

    await this.postingRepo.unpostIndividualEntry(input.entryId);

    // Return updated entry
    const updatedEntry = await this.accountingRepo.getEntryById(input.entryId);
    return updatedEntry!;
  }

  async executeSideEffectsPhase(result: JournalEntry, userId: string): Promise<void> {
    if (!this.auditRepo) return;
    try {
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId),
          action: "posting:entry:unpost",
          entityType: "JournalEntry",
          entityId: result.id!,
          timestamp: new Date().toISOString(),
          changeDescription: `إلغاء ترحيل قيد يومي رقم ${result.entryNumber ?? result.id}`,
          metadata: {
            entryId: result.id,
            entryNumber: result.entryNumber,
            entryDate: result.entryDate,
            postingBatchId: result.postingBatchId ?? null,
          },
        }),
      );
    } catch {
      // Audit must not break committed unpost.
    }
  }

  toEntity(result: JournalEntry): JournalEntry {
    return result;
  }
}
