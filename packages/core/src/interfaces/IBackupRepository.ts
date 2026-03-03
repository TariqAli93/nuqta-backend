/**
 * IBackupRepository Interface
 * Defines backup persistence and file-system contract
 */

export interface BackupInfo {
  name: string;
  sizeBytes: number;
  createdAt: string;
  path: string;
}

export interface BackupStats {
  totalBackups: number;
  totalSizeBytes: number;
  latestBackup: BackupInfo | null;
  oldestBackup: BackupInfo | null;
  backupPath: string;
}

export interface IBackupRepository {
  /**
   * Create a new database backup
   * @returns metadata about the created backup
   */
  create(): Promise<BackupInfo>;

  /**
   * List all available backups
   */
  list(): Promise<BackupInfo[]>;

  /**
   * Restore database from a named backup
   * @param backupName The file name of the backup to restore
   */
  restore(backupName: string): Promise<void>;

  /**
   * Delete a backup file by name
   * @param backupName The file name of the backup to delete
   * @returns true if deleted, false if not found
   */
  delete(backupName: string): Promise<boolean>;

  /**
   * Get backup statistics
   */
  getStats(): Promise<BackupStats>;

  /**
   * Check if a backup file exists
   */
  exists(backupName: string): Promise<boolean>;
}
