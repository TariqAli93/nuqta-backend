import { IPostingRepository } from '../../interfaces/IPostingRepository.js';
import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { JournalEntry } from '../../entities/Accounting.js';
import { NotFoundError, InvalidStateError } from '../../shared/errors/DomainErrors.js';
import { AuditEvent } from "../../entities/AuditEvent.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { entryId: number };

export class PostIndividualEntryUseCase extends WriteUseCase<TInput, JournalEntry, JournalEntry> {
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

    if (entry.isPosted) {
      throw new InvalidStateError(`Journal entry ${input.entryId} is already posted`, { entryId: input.entryId });
    }

    if (entry.isReversed) {
      throw new InvalidStateError(`Journal entry ${input.entryId} is reversed and cannot be posted`, { entryId: input.entryId });
    }

    // Validate entry is balanced before posting
    const lines = entry.lines || [];
    if (lines.length === 0) {
      throw new InvalidStateError('Cannot post journal entry without lines', { entryId: input.entryId });
    }
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    if (totalDebit !== totalCredit) {
      throw new InvalidStateError('Cannot post unbalanced journal entry', {
        entryId: input.entryId,
        entryNumber: entry.entryNumber,
        debit: totalDebit,
        credit: totalCredit,
      });
    }

    await this.postingRepo.postIndividualEntry(input.entryId);

    // Return updated entry
    const updatedEntry = await this.accountingRepo.getEntryById(input.entryId);
    return updatedEntry!;
  }

  async executeSideEffectsPhase(result: JournalEntry, userId: string): Promise<void> {
    if (!this.auditRepo) return;
    try {
      const totalAmount = (result.lines ?? []).reduce((sum, l) => sum + (l.debit || 0), 0);
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId),
          action: "posting:entry:post",
          entityType: "JournalEntry",
          entityId: result.id!,
          timestamp: new Date().toISOString(),
          changeDescription: `ترحيل قيد يومي رقم ${result.entryNumber ?? result.id}`,
          metadata: {
            entryId: result.id,
            entryNumber: result.entryNumber,
            entryDate: result.entryDate,
            totalAmount,
          },
        }),
      );
    } catch {
      // Audit must not break committed post.
    }
  }

  toEntity(result: JournalEntry): JournalEntry {
    return result;
  }
}
