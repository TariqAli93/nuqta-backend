import { IUserRepository } from '../../interfaces/IUserRepository.js';
import { User } from '../../entities/User.js';
import { hashPassword } from '../../shared/utils/helpers.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class CreateUserUseCase extends WriteUseCase<User, User, User> {
  constructor(private userRepo: IUserRepository) {
    super();
  }

  async executeCommitPhase(user: User, _userId: string): Promise<User> {
    if (user.password) {
      user.password = await hashPassword(user.password);
    }
    return await this.userRepo.create(user);
  }

  executeSideEffectsPhase(_result: User, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: User): User {
    return result;
  }
}
