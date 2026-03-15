/**
 * GenerateBackupTokenUseCase — Generates a one-time download token for a backup
 */
import { JwtService } from "../../shared/services/JwtService.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export interface BackupToken {
  token: string;
  expiresIn: number;
}

type TInput = { backupName: string };

export class GenerateBackupTokenUseCase extends WriteUseCase<TInput, BackupToken, BackupToken> {
  constructor(private jwtService: JwtService) {
    super();
  }

  async executeCommitPhase(input: TInput, userId: string): Promise<BackupToken> {
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

  executeSideEffectsPhase(_result: BackupToken, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: BackupToken): BackupToken {
    return result;
  }
}
