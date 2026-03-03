/**
 * DeleteBackupUseCase — Deletes a backup file by name
 */
import { IBackupRepository } from "../../interfaces/IBackupRepository.js";
import { IAuditRepository } from "../../interfaces/IAuditRepository.js";
import { NotFoundError } from "../../errors/DomainErrors.js";
import { AuditEvent } from "../../entities/AuditEvent.js";

export class DeleteBackupUseCase {
  constructor(
    private backupRepo: IBackupRepository,
    private auditRepo?: IAuditRepository,
  ) {}

  async execute(backupName: string, userId: number): Promise<void> {
    const deleted = await this.backupRepo.delete(backupName);
    if (!deleted) {
      throw new NotFoundError(`Backup not found: ${backupName}`);
    }

    if (this.auditRepo) {
      await this.auditRepo.create(
        new AuditEvent({
          userId,
          action: "backup.deleted",
          entityType: "backup",
          entityId: 0,
          metadata: { backupName },
          timestamp: new Date().toISOString(),
        }),
      );
    }
  }
}
