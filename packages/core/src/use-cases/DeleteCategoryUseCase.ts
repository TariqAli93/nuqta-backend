import { ICategoryRepository } from '../interfaces/ICategoryRepository.js';

export class DeleteCategoryUseCase {
  constructor(private categoryRepo: ICategoryRepository) {}

  async execute(id: number) {
    return await this.categoryRepo.delete(id);
  }
}
