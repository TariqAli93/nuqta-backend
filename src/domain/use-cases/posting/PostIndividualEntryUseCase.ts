import { IPostingRepository } from '../../interfaces/IPostingRepository.js';
import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';
import { JournalEntry } from '../../entities/Accounting.js';
import { NotFoundError, InvalidStateError } from '../../shared/errors/DomainErrors.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { entryId: number };

export class PostIndividualEntryUseCase extends WriteUseCase<TInput, JournalEntry, JournalEntry> {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository
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

  executeSideEffectsPhase(_result: JournalEntry, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: JournalEntry): JournalEntry {
    return result;
  }
}
