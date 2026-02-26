import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { JournalEntry } from "../../entities/Accounting.js";

export class UnpostIndividualEntryUseCase {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository,
  ) {}

  async execute(entryId: number, userId: number): Promise<JournalEntry> {
    const entry = await this.accountingRepo.getEntryById(entryId);

    if (!entry) {
      throw new Error(`Journal entry ${entryId} not found`);
    }

    if (!entry.isPosted) {
      throw new Error(`Journal entry ${entryId} is not posted`);
    }

    if (entry.postingBatchId) {
      const isLocked = await this.postingRepo.isBatchLocked(
        entry.postingBatchId,
      );
      if (isLocked) {
        throw new Error(
          `Cannot unpost entry ${entryId} because its posting batch ${entry.postingBatchId} is locked`,
        );
      }
    }

    await this.postingRepo.unpostIndividualEntry(entryId);

    // Return updated entry
    const updatedEntry = await this.accountingRepo.getEntryById(entryId);
    return updatedEntry!;
  }
}
