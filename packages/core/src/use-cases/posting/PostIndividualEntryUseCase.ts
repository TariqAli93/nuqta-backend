import { IPostingRepository } from '../../interfaces/IPostingRepository.js';
import { IAccountingRepository } from '../../interfaces/IAccountingRepository.js';
import { JournalEntry } from '../../entities/Accounting.js';

export class PostIndividualEntryUseCase {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository
  ) {}

  async execute(entryId: number, userId: number): Promise<JournalEntry> {
    const entry = await this.accountingRepo.getEntryById(entryId);

    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }

    if (entry.isPosted) {
      throw new Error(`Journal entry ${entryId} is already posted`);
    }

    if (entry.isReversed) {
      throw new Error(`Journal entry ${entryId} is reversed and cannot be posted`);
    }

    this.postingRepo.postIndividualEntry(entryId);

    // Return updated entry
    const updatedEntry = await this.accountingRepo.getEntryById(entryId);
    return updatedEntry!;
  }
}
