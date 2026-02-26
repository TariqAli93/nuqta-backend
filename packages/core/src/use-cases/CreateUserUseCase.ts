import { IUserRepository } from '../interfaces/IUserRepository.js';
import { User } from '../entities/User.js';

import { hashPassword } from '../utils/helpers.js';

export class CreateUserUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(user: User) {
    if (user.password) {
      user.password = await hashPassword(user.password);
    }
    return await this.userRepo.create(user);
  }
}
