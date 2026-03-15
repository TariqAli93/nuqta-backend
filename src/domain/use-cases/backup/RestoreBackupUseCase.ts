/**
 * RestoreBackupUseCase — Restores database from a named backup
 */
import { IBackupRepository } from "../../interfaces/IBackupRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { backupName: string };

export class RestoreBackupUseCase extends WriteUseCase<TInput, void, void> {
  constructor(
    private backupRepo: IBackupRepository,
    private auditRepo?: IAuditRepository,
  ) {
    super();
  }

  async executeCommitPhase(input: TInput, userId: string): Promise<void> {
    const exists = await this.backupRepo.exists(input.backupName);
    if (!exists) {
      throw new NotFoundError(`Backup not found: ${input.backupName}`);
    }

    await this.backupRepo.restore(input.backupName);

    if (this.auditRepo) {
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId) || 0,
          action: "backup.restored",
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
