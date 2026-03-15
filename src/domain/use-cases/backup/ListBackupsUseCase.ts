/**
 * ListBackupsUseCase — Returns all available backup files
 */
import {
  IBackupRepository,
  BackupInfo,
} from "../../interfaces/IBackupRepository.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class ListBackupsUseCase extends ReadUseCase<void, BackupInfo[]> {
  constructor(private backupRepo: IBackupRepository) {
    super();
  }

  async execute(): Promise<BackupInfo[]> {
    return this.backupRepo.list();
  }
}
