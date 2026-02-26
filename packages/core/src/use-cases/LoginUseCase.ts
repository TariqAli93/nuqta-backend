import { IUserRepository } from '../interfaces/IUserRepository.js';
import { User } from '../entities/User.js';
import { UnauthorizedError, ValidationError } from '../errors/DomainErrors.js';
import { PermissionService, UserRole } from '../services/PermissionService.js';
import { comparePassword } from '../utils/helpers.js';

export class LoginUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(credentials: {
    username: string;
    password: string;
  }): Promise<{ user: Omit<User, 'password'>; permissions: string[] }> {
    const user = await this.userRepo.findByUsername(credentials.username);

    if (!user) {
      throw new UnauthorizedError('البيانات غير صحيحة');
    }

    if (!user.isActive) {
      throw new ValidationError('الحساب غير نشط', { userId: user.id });
    }

    const isValid = await comparePassword(credentials.password, user.password);

    if (!isValid) {
      throw new UnauthorizedError('البيانات غير صحيحة');
    }

    // Update last login
    await this.userRepo.update(user.id!, { lastLoginAt: new Date().toISOString() });

    // Get permissions for user's role
    const permissions = PermissionService.getPermissionsForRole(user.role as UserRole);

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
