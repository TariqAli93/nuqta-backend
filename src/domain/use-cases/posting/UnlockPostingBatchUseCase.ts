/**
 * UnlockPostingBatchUseCase
 * Unlocks a previously locked posting batch.
 */
import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { batchId: number };
type TEntity = { batchId: number; status: string };

export class UnlockPostingBatchUseCase extends WriteUseCase<TInput, TEntity, TEntity> {
  constructor(private postingRepo: IPostingRepository) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<TEntity> {
    const batch = await this.postingRepo.getBatchById(input.batchId);
    if (!batch) {
      throw new NotFoundError("دفعة الترحيل غير موجودة");
    }

    const isLocked = await this.postingRepo.isBatchLocked(input.batchId);
    if (!isLocked) {
      throw new InvalidStateError("الدفعة غير مقفلة");
    }

    await this.postingRepo.unlockBatch(input.batchId);
    return { batchId: input.batchId, status: "unlocked" };
  }

  executeSideEffectsPhase(_result: TEntity, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }
}
