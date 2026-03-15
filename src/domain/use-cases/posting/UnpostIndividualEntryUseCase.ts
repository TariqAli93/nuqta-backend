import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { JournalEntry } from "../../entities/Accounting.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { entryId: number };

export class UnpostIndividualEntryUseCase extends WriteUseCase<TInput, JournalEntry, JournalEntry> {
  constructor(
    private postingRepo: IPostingRepository,
    private accountingRepo: IAccountingRepository,
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

  executeSideEffectsPhase(_result: JournalEntry, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: JournalEntry): JournalEntry {
    return result;
  }
}
