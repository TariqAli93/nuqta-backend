/**
 * UnlockPostingBatchUseCase
 * Unlocks a previously locked posting batch.
 */
import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";

export class UnlockPostingBatchUseCase {
  constructor(private postingRepo: IPostingRepository) {}

  async execute(batchId: number, userId: number) {
    const batch = await this.postingRepo.getBatchById(batchId);
    if (!batch) {
      throw new NotFoundError("دفعة الترحيل غير موجودة");
    }

    const isLocked = await this.postingRepo.isBatchLocked(batchId);
    if (!isLocked) {
      throw new InvalidStateError("الدفعة غير مقفلة");
    }

    await this.postingRepo.unlockBatch(batchId);
    return { batchId, status: "unlocked" };
  }
}
