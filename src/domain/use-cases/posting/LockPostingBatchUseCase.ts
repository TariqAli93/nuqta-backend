/**
 * LockPostingBatchUseCase
 * Locks a posting batch to prevent modifications.
 */
import { IPostingRepository } from "../../interfaces/IPostingRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError, InvalidStateError } from "../../shared/errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { batchId: number };
type TEntity = { batchId: number; status: string; periodStart?: string; periodEnd?: string };

export class LockPostingBatchUseCase extends WriteUseCase<TInput, TEntity, TEntity> {
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
    if (isLocked) {
      throw new InvalidStateError("الدفعة مقفلة بالفعل");
    }

    await this.postingRepo.lockBatch(input.batchId);
    return {
      batchId: input.batchId,
      status: "locked",
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
          action: "posting:batch:lock",
          entityType: "PostingBatch",
          entityId: result.batchId,
          timestamp: new Date().toISOString(),
          changeDescription: `قفل دفعة الترحيل رقم ${result.batchId}`,
          metadata: {
            batchId: result.batchId,
            periodStart: result.periodStart,
            periodEnd: result.periodEnd,
          },
        }),
      );
    } catch {
      // Audit must not break committed lock.
    }
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }
}
