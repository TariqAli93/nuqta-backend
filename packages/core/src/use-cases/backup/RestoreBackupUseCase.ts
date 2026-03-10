/**
 * RestoreBackupUseCase — Restores database from a named backup
 */
import { IBackupRepository } from "../../interfaces/IBackupRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";

export class RestoreBackupUseCase {
  constructor(
    private backupRepo: IBackupRepository,
    private auditRepo?: IAuditRepository,
  ) {}

  async execute(backupName: string, userId: number): Promise<void> {
    const exists = await this.backupRepo.exists(backupName);
    if (!exists) {
      throw new NotFoundError(`Backup not found: ${backupName}`);
    }

    await this.backupRepo.restore(backupName);

    if (this.auditRepo) {
      await this.auditRepo.create(
        new AuditEvent({
          userId,
          action: "backup.restored",
          entityType: "backup",
          entityId: 0,
          metadata: { backupName },
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }
}
