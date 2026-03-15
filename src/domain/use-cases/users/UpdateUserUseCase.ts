import { IUserRepository } from '../../interfaces/IUserRepository.js';
import { User } from '../../entities/User.js';
import { hashPassword } from '../../shared/utils/helpers.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { id: number; user: Partial<User> };

export class UpdateUserUseCase extends WriteUseCase<TInput, User, User> {
  constructor(private userRepo: IUserRepository) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<User> {
    if (input.user.password) {
      input.user.password = await hashPassword(input.user.password);
    }
    return await this.userRepo.update(input.id, input.user);
  }

  executeSideEffectsPhase(_result: User, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: User): User {
    return result;
  }
}
