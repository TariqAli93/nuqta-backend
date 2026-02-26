import { ICategoryRepository } from '../interfaces/ICategoryRepository.js';
import { Category } from '../entities/Category.js';

import { ValidationError } from '../errors/DomainErrors.js';

export class UpdateCategoryUseCase {
  constructor(private categoryRepo: ICategoryRepository) {}

  async execute(id: number, category: Partial<Category>) {
    if (category.name !== undefined && category.name.trim().length === 0) {
      throw new ValidationError('Category name cannot be empty');
    }
    return await this.categoryRepo.update(id, category);
  }
}
