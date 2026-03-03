/**
 * ListBackupsUseCase — Returns all available backup files
 */
import {
  IBackupRepository,
  BackupInfo,
} from "../../interfaces/IBackupRepository.js";

export class ListBackupsUseCase {
  constructor(private backupRepo: IBackupRepository) {}

  async execute(): Promise<BackupInfo[]> {
    return this.backupRepo.list();
  }
}
