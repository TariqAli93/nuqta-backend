import { IUserRepository } from '../../interfaces/IUserRepository.js';
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetUserByIdUseCase extends ReadUseCase<number, Awaited<ReturnType<IUserRepository["findById"]>>> {
  constructor(private userRepo: IUserRepository) {
    super();
  }

  async execute(id: number) {
    return await this.userRepo.findById(id);
  }
}
