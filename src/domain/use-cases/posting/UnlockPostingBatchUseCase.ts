/**
 * UnlockPostingBatchUseCase
 * Unlocks a previously locked posting batch.
 */
import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { batchId: number };
type TEntity = { batchId: number; status: string; periodStart?: string; periodEnd?: string };

export class UnlockPostingBatchUseCase extends WriteUseCase<TInput, TEntity, TEntity> {
  constructor(
    private postingRepo: IPostingRepository,
    private auditRepo?: IAuditRepository,
  ) {
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
    return {
      batchId: input.batchId,
      status: "unlocked",
      periodStart: (batch as any).periodStart,
      periodEnd: (batch as any).periodEnd,
    };
  }

  async executeSideEffectsPhase(result: TEntity, userId: string): Promise<void> {
    if (!this.auditRepo) return;
    try {
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId),
          action: "posting:batch:unlock",
          entityType: "PostingBatch",
          entityId: result.batchId,
          timestamp: new Date().toISOString(),
          changeDescription: `فتح قفل دفعة الترحيل رقم ${result.batchId}`,
          metadata: {
            batchId: result.batchId,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
          },
        }),
      );
    } catch {
      // Audit must not break committed unlock.
    }
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }
}
