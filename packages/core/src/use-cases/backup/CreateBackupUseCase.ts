/**
 * CreateBackupUseCase — Triggers creation of a database backup
 */
import {
  IBackupRepository,
  BackupInfo,
} from "../../interfaces/IBackupRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { AuditEvent } from "../../entities/AuditEvent.js";

export class CreateBackupUseCase {
  constructor(
    private backupRepo: IBackupRepository,
    private auditRepo?: IAuditRepository,
  ) {}

  async execute(userId: number): Promise<BackupInfo> {
    const backup = await this.backupRepo.create();

    if (this.auditRepo) {
      await this.auditRepo.create(
        new AuditEvent({
          userId,
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
}
