import { IUserRepository } from '../interfaces/IUserRepository.js';
import { User } from '../entities/User.js';

import { hashPassword } from '../utils/helpers.js';

export class UpdateUserUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(id: number, user: Partial<User>) {
    if (user.password) {
      user.password = await hashPassword(user.password);
    }
    return await this.userRepo.update(id, user);
  }
}
