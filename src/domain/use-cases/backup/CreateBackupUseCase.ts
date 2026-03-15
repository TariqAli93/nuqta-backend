/**
 * CreateBackupUseCase — Triggers creation of a database backup
 */
import {
  IBackupRepository,
  BackupInfo,
} from "../../interfaces/IBackupRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { AuditEvent } from "../../entities/AuditEvent.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class CreateBackupUseCase extends WriteUseCase<void, BackupInfo, BackupInfo> {
  constructor(
    private backupRepo: IBackupRepository,
    private auditRepo?: IAuditRepository,
  ) {
    super();
  }

  async executeCommitPhase(_input: void, userId: string): Promise<BackupInfo> {
    const backup = await this.backupRepo.create();

    if (this.auditRepo) {
      await this.auditRepo.create(
        new AuditEvent({
          userId: Number(userId) || 0,
          action: "backup.created",
          entityType: "backup",
          entityId: 0,
          metadata: { backupName: backup.name },
          timestamp: new Date().toISOString(),
        }),
      );
    }

    return backup;
  }

  executeSideEffectsPhase(_result: BackupInfo, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: BackupInfo): BackupInfo {
    return result;
  }
}
