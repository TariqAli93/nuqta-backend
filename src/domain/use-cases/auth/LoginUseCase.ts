import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { User } from "../../entities/User.js";
import { UnauthorizedError, ValidationError } from "../../shared/errors/DomainErrors.js";
import { getPermissionsForRole, UserRole } from "../../shared/services/PermissionService.js";
import { comparePassword } from "../../shared/utils/helpers.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { username: string; password: string };
type TEntity = { user: Omit<User, "password">; permissions: string[] };

export class LoginUseCase extends WriteUseCase<TInput, TEntity, TEntity> {
  constructor(private userRepo: IUserRepository) {
    super();
  }

  async executeCommitPhase(
    credentials: TInput,
    _userId: string,
  ): Promise<TEntity> {
    const user = await this.userRepo.findByUsername(credentials.username);

    if (!user) {
      throw new UnauthorizedError("البيانات غير صحيحة");
    }

    if (!user.isActive) {
      throw new ValidationError("الحساب غير نشط", { userId: user.id });
    }

    const isValid = await comparePassword(credentials.password, user.password);

    if (!isValid) {
      throw new UnauthorizedError("البيانات غير صحيحة");
    }

    // await this.userRepo.updateLastLogin(user.id as number);
    await this.userRepo.updateLastLogin(user.id as number);

    const permissions = getPermissionsForRole(
      user.role as UserRole,
    );

    return {
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      permissions,
    };
  }

  executeSideEffectsPhase(_result: TEntity, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }
}
