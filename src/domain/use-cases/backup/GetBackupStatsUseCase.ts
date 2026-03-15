/**
 * GetBackupStatsUseCase — Returns backup statistics
 */
import {
  IBackupRepository,
  BackupStats,
} from "../../interfaces/IBackupRepository.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetBackupStatsUseCase extends ReadUseCase<void, BackupStats> {
  constructor(private backupRepo: IBackupRepository) {
    super();
  }

  async execute(): Promise<BackupStats> {
    return this.backupRepo.getStats();
  }
}
