import { WriteUseCase } from "../../shared/WriteUseCase.js";
import type { IRevokedTokenRepository } from "../../interfaces/IRevokedTokenRepository.js";
import type { JwtPayload } from "../../shared/services/JwtService.js";
import { ValidationError } from "../../shared/errors/DomainErrors.js";

export interface LogoutInput {
  /** Decoded access token payload (jti + exp used for revocation). */
  accessToken: JwtPayload & { jti: string; exp: number };
  /** Optional decoded refresh token for dual-token revocation. */
  refreshToken?: JwtPayload & { jti: string; exp: number };
}

export class LogoutUseCase extends WriteUseCase<LogoutInput, void, void> {
  constructor(private revokedTokenRepo: IRevokedTokenRepository) {
    super();
  }

  async executeCommitPhase(
    input: LogoutInput,
    _userId: string,
  ): Promise<void> {
    const { accessToken, refreshToken } = input;

    if (!accessToken.jti) {
      throw new ValidationError("Access token is missing the jti claim");
    }

    const accessExpiresAt = new Date(accessToken.exp * 1000);
    await this.revokedTokenRepo.revoke(accessToken.jti, accessExpiresAt);

    if (refreshToken?.jti) {
      const refreshExpiresAt = new Date(refreshToken.exp * 1000);
      await this.revokedTokenRepo.revoke(refreshToken.jti, refreshExpiresAt);
    }
  }

  executeSideEffectsPhase(_result: void, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(_result: void): void {
    return undefined;
  }
}
