import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { pipeline } from "node:stream/promises";
import { createReadStream, createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import type { IBackupRepository, BackupInfo, BackupStats } from "../../../domain/index.js";

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
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;

    if (encryptionKey) {
      // Encrypted path: dump to temp file, encrypt, remove plaintext
      const rawName = `backup-${timestamp}.dump`;
      const encName = `backup-${timestamp}.dump.enc`;
      const rawPath = path.join(this.backupDir, rawName);
      const encPath = path.join(this.backupDir, encName);

      await runPgCommand(process.env.PG_DUMP_PATH || "pg_dump", [
        "--dbname",
        this.databaseUrl,
        "--format",
        "custom",
        "--file",
        rawPath,
      ]);

      await this.encryptFile(rawPath, encPath, encryptionKey);
      await fs.unlink(rawPath); // Remove unencrypted backup

      const stat = await fs.stat(encPath);
      return {
        name: encName,
        sizeBytes: stat.size,
        createdAt: stat.mtime.toISOString(),
        path: encPath,
      };
    }

    // Unencrypted path (development / no key configured)
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

  /**
   * Encrypt a file using AES-256-GCM.
   * Format: [12-byte IV][ciphertext][16-byte auth tag]
   */
  private async encryptFile(
    inputPath: string,
    outputPath: string,
    hexKey: string,
  ): Promise<void> {
    const key = Buffer.from(hexKey, "hex");
    if (key.length !== 32) {
      throw new Error(
        "BACKUP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
      );
    }
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);

    const src = createReadStream(inputPath);
    const dst = createWriteStream(outputPath);

    // Write IV first
    dst.write(iv);

    await pipeline(src, cipher, dst);

    // Append auth tag
    const authTag = cipher.getAuthTag();
    await fs.appendFile(outputPath, authTag);
  }

  /**
   * Decrypt a file that was encrypted with encryptFile().
   * Used by restore() when the file has a .enc extension.
   */
  private async decryptFile(
    inputPath: string,
    outputPath: string,
    hexKey: string,
  ): Promise<void> {
    const key = Buffer.from(hexKey, "hex");
    if (key.length !== 32) {
      throw new Error(
        "BACKUP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes)",
      );
    }

    const fileBuffer = await fs.readFile(inputPath);
    const iv = fileBuffer.subarray(0, 12);
    // Auth tag is the last 16 bytes
    const authTag = fileBuffer.subarray(fileBuffer.length - 16);
    const ciphertext = fileBuffer.subarray(12, fileBuffer.length - 16);

    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    await fs.writeFile(outputPath, decrypted);
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

    let restorePath = filePath;
    let tempDecryptedPath: string | undefined;

    if (backupName.endsWith(".enc")) {
      const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY;
      if (!encryptionKey) {
        throw new Error(
          "BACKUP_ENCRYPTION_KEY is required to restore encrypted backups",
        );
      }
      tempDecryptedPath = filePath.replace(/\.enc$/, ".tmp");
      await this.decryptFile(filePath, tempDecryptedPath, encryptionKey);
      restorePath = tempDecryptedPath;
    }

    try {
      await runPgCommand(process.env.PG_RESTORE_PATH || "pg_restore", [
        "--dbname",
        this.databaseUrl,
        "--clean",
        "--if-exists",
        "--single-transaction",
        "--no-owner",
        restorePath,
      ]);
    } finally {
      if (tempDecryptedPath) {
        await fs.unlink(tempDecryptedPath).catch(() => {});
      }
    }
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
