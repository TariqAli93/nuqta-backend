import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";
import type { IBackupRepository, BackupInfo, BackupStats } from "@nuqta/core";
import "dotenv/config";

const execFileAsync = promisify(execFile);

/** Only allows alphanumeric, hyphens, underscores, and dots (no path traversal) */
const SAFE_NAME = /^[\w\-.]+$/;

function assertSafeName(name: string): void {
  if (!SAFE_NAME.test(name) || name.includes("..")) {
    throw new Error(`Invalid backup name: ${name}`);
  }
}

async function runPgCommand(
  command: string,
  args: string[],
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFileAsync(command, args);
  } catch (err: any) {
    const stderr = err.stderr?.trim();
    throw new Error(`${command} failed: ${stderr || err.message}`);
  }
}

interface BackupRepositoryOptions {
  backupDir?: string;
  databaseUrl?: string;
}

export class BackupRepository implements IBackupRepository {
  private readonly backupDir: string;
  private readonly databaseUrl: string;

  constructor(options: BackupRepositoryOptions = {}) {
    this.backupDir = path.resolve(
      options.backupDir ||
        process.env.BACKUP_DIR ||
        path.join(process.cwd(), "backups"),
    );

    const dbUrl = options.databaseUrl || process.env.DATABASE_URL;
    if (!dbUrl) throw new Error("DATABASE_URL is not set");
    this.databaseUrl = dbUrl;
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.backupDir, { recursive: true });
  }

  private resolvePath(backupName: string): string {
    assertSafeName(backupName);
    return path.join(this.backupDir, backupName);
  }

  async create(): Promise<BackupInfo> {
    await this.ensureDir();

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const name = `backup-${timestamp}.dump`;
    const filePath = path.join(this.backupDir, name);

    await runPgCommand(process.env.PG_DUMP_PATH || "pg_dump", [
      "--dbname",
      this.databaseUrl,
      "--format",
      "custom",
      "--file",
      filePath,
    ]);

    const stat = await fs.stat(filePath);

    return {
      name,
      sizeBytes: stat.size,
      createdAt: stat.mtime.toISOString(),
      path: filePath,
    };
  }

  async list(): Promise<BackupInfo[]> {
    await this.ensureDir();

    const entries = await fs.readdir(this.backupDir, { withFileTypes: true });

    const infos: BackupInfo[] = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const full = path.join(this.backupDir, entry.name);
      try {
        const stat = await fs.stat(full);
        infos.push({
          name: entry.name,
          sizeBytes: stat.size,
          createdAt: stat.mtime.toISOString(),
          path: full,
        });
      } catch {
        // Ignore errors for individual files
      }
    }

    infos.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return infos;
  }

  async restore(backupName: string): Promise<void> {
    const filePath = this.resolvePath(backupName);

    if (!(await this.fileExists(filePath))) {
      throw new Error(`Backup not found: ${backupName}`);
    }

    await runPgCommand(process.env.PG_RESTORE_PATH || "pg_restore", [
      "--dbname",
      this.databaseUrl,
      "--clean",
      "--if-exists",
      "--single-transaction",
      "--no-owner",
      filePath,
    ]);
  }

  async delete(backupName: string): Promise<boolean> {
    const filePath = this.resolvePath(backupName);

    if (!(await this.fileExists(filePath))) {
      return false;
    }

    await fs.unlink(filePath);
    return true;
  }

  async getStats(): Promise<BackupStats> {
    const backups = await this.list();
    const totalSizeBytes = backups.reduce((sum, b) => sum + b.sizeBytes, 0);

    return {
      totalBackups: backups.length,
      totalSizeBytes,
      latestBackup: backups[0] ?? null,
      oldestBackup: backups.at(-1) ?? null,
      backupPath: this.backupDir,
    };
  }

  async exists(backupName: string): Promise<boolean> {
    return this.fileExists(this.resolvePath(backupName));
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}
