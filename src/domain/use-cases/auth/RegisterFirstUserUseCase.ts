import { IUserRepository } from '../../interfaces/IUserRepository.js';
import { User } from '../../entities/User.js';
import { ConflictError } from '../../shared/errors/DomainErrors.js';
import { hashPassword } from '../../shared/utils/helpers.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'isActive'>;
type TEntity = Omit<User, 'password'>;

export class RegisterFirstUserUseCase extends WriteUseCase<TInput, TEntity, TEntity> {
  constructor(private userRepo: IUserRepository) {
    super();
  }

  async executeCommitPhase(
    userData: TInput,
    userId: string,
  ): Promise<TEntity> {
    const userCount = await this.userRepo.count();

    // Safety check: Only allow if no users exist
    if (userCount > 0) {
      throw new ConflictError('Users already exist. First user setup is not available.', {
        userCount,
      });
    }

    const hashedPassword = await hashPassword(userData.password);

    const newUser = await this.userRepo.create({
      ...userData,
      password: hashedPassword,
      role: 'admin', // Force admin role
      isActive: true,
    });

    // Return user without password
    const { password, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
  }

  executeSideEffectsPhase(_result: TEntity, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: TEntity): TEntity {
    return result;
  }
}
