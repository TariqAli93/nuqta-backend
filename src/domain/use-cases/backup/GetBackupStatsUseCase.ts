/**
 * GetBackupStatsUseCase — Returns backup statistics
 */
import {
  IBackupRepository,
  BackupStats,
} from "../../interfaces/IBackupRepository.js";

export class GetBackupStatsUseCase {
  constructor(private backupRepo: IBackupRepository) {}

  async execute(): Promise<BackupStats> {
    return this.backupRepo.getStats();
  }
}
