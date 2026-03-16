/**
 * DeleteBackupUseCase — Deletes a backup file by name
 */
import { IBackupRepository } from "../../interfaces/IBackupRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { backupName: string };

export class DeleteBackupUseCase extends WriteUseCase<TInput, void, void> {
  constructor(
    private backupRepo: IBackupRepository,
    private auditRepo?: IAuditRepository,
  ) {
    super();
  }

  async executeCommitPhase(input: TInput, userId: string): Promise<void> {
    const deleted = await this.backupRepo.delete(input.backupName);
    if (!deleted) {
      throw new NotFoundError(`Backup not found: ${input.backupName}`);
    }

    if (this.auditRepo) {
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId) || 0,
          action: "backup.deleted",
          entityType: "backup",
          entityId: 0,
          metadata: { backupName: input.backupName },
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }

  executeSideEffectsPhase(_r: void, _u: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: void): void {
    return result;
  }
}
