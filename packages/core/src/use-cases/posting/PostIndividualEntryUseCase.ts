import { IPostingRepository } from '../../interfaces/IPostingRepository.js';
import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';
import { JournalEntry } from '../../entities/Accounting.js';
import { NotFoundError, InvalidStateError } from '../../shared/errors/DomainErrors.js';

export class PostIndividualEntryUseCase {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository
  ) {}

  async execute(entryId: number, userId: number): Promise<JournalEntry> {
    const entry = await this.accountingRepo.getEntryById(entryId);

    if (!entry) {
      throw new NotFoundError(`Journal entry ${entryId} not found`, { entryId });
    }

    if (entry.isPosted) {
      throw new InvalidStateError(`Journal entry ${entryId} is already posted`, { entryId });
    }

    if (entry.isReversed) {
      throw new InvalidStateError(`Journal entry ${entryId} is reversed and cannot be posted`, { entryId });
    }

    // Validate entry is balanced before posting
    const lines = entry.lines || [];
    if (lines.length === 0) {
      throw new InvalidStateError('Cannot post journal entry without lines', { entryId });
    }
    const totalDebit = lines.reduce((sum, line) => sum + (line.debit || 0), 0);
    const totalCredit = lines.reduce((sum, line) => sum + (line.credit || 0), 0);
    if (totalDebit !== totalCredit) {
      throw new InvalidStateError('Cannot post unbalanced journal entry', {
        entryId,
        entryNumber: entry.entryNumber,
        debit: totalDebit,
        credit: totalCredit,
      });
    }

    await this.postingRepo.postIndividualEntry(entryId);

    // Return updated entry
    const updatedEntry = await this.accountingRepo.getEntryById(entryId);
    return updatedEntry!;
  }
}
