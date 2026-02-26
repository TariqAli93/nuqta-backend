import { IUserRepository } from '../interfaces/IUserRepository.js';
import { User } from '../entities/User.js';
import { ConflictError } from '../errors/DomainErrors.js';
import { hashPassword } from '../utils/helpers.js';

export class RegisterFirstUserUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(
    userData: Omit<User, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt' | 'isActive'>
  ): Promise<Omit<User, 'password'>> {
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
}
