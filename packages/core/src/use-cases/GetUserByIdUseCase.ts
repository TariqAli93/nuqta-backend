import { IUserRepository } from "../interfaces/IUserRepository.js";

export class GetUserByIdUseCase {
  constructor(private userRepo: IUserRepository) {}

  async execute(id: number) {
    return await this.userRepo.findById(id);
  }
}
