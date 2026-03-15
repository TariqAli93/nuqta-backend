/**
 * GenerateBackupTokenUseCase — Generates a one-time download token for a backup
 */
import { JwtService } from "../../shared/services/JwtService.js";

export interface BackupToken {
  token: string;
  expiresIn: number;
}

export class GenerateBackupTokenUseCase {
  constructor(private jwtService: JwtService) {}

  async execute(backupName: string, userId: number): Promise<BackupToken> {
    const expiresIn = 300; // 5 minutes
    const token = this.jwtService.signAccess({
      sub: String(userId),
      role: "admin",
      permissions: ["backup:create"],
      username: "",
      fullName: "",
    });
    return { token, expiresIn };
  }
}
