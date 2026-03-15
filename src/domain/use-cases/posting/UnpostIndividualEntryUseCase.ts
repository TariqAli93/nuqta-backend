import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { JournalEntry } from "../../entities/Accounting.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";

export class UnpostIndividualEntryUseCase {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository,
  ) {}

  async execute(entryId: number, userId: number): Promise<JournalEntry> {
    const entry = await this.accountingRepo.getEntryById(entryId);

    if (!entry) {
      throw new NotFoundError(`Journal entry ${entryId} not found`, { entryId });
    }

    if (!entry.isPosted) {
      throw new InvalidStateError(`Journal entry ${entryId} is not posted`, { entryId });
    }

    if (entry.postingBatchId) {
      const isLocked = await this.postingRepo.isBatchLocked(
        entry.postingBatchId,
      );
      if (isLocked) {
        throw new InvalidStateError(
          `Cannot unpost entry in a locked posting batch`,
          { entryId, postingBatchId: entry.postingBatchId },
        );
      }
    }

    await this.postingRepo.unpostIndividualEntry(entryId);

    // Return updated entry
    const updatedEntry = await this.accountingRepo.getEntryById(entryId);
    return updatedEntry!;
  }
}
