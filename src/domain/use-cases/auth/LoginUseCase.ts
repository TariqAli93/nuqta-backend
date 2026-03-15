import { IUserRepository } from "../../interfaces/IUserRepository.js";
import { User } from "../../entities/User.js";
import { UnauthorizedError, ValidationError } from "../../shared/errors/DomainErrors.js";
import { getPermissionsForRole, UserRole } from "../../shared/services/PermissionService.js";
import { comparePassword } from "../../shared/utils/helpers.js";

export class LoginUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(credentials: {
    username: string;
    password: string;
  }): Promise<{ user: Omit<User, "password">; permissions: string[] }> {
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
}
