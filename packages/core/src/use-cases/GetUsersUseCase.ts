import { IUserRepository } from '../interfaces/IUserRepository.js';

export class GetUsersUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute() {
    return await this.userRepo.findAll();
  }
}
