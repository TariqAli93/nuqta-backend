/**
 * LockPostingBatchUseCase
 * Locks a posting batch to prevent modifications.
 */
import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";

export class LockPostingBatchUseCase {
  constructor(private postingRepo: IPostingRepository) {}

  async execute(batchId: number, userId: number) {
    const batch = await this.postingRepo.getBatchById(batchId);
    if (!batch) {
      throw new NotFoundError("دفعة الترحيل غير موجودة");
    }

    const isLocked = await this.postingRepo.isBatchLocked(batchId);
    if (isLocked) {
      throw new InvalidStateError("الدفعة مقفلة بالفعل");
    }

    await this.postingRepo.lockBatch(batchId);
    return { batchId, status: "locked" };
  }
}
