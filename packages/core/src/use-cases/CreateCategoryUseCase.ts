import { ICategoryRepository } from '../interfaces/ICategoryRepository.js';
import { Category } from '../entities/Category.js';

import { ValidationError } from '../errors/DomainErrors.js';

export class CreateCategoryUseCase {
  constructor(private categoryRepo: ICategoryRepository) {}

  async execute(category: Category) {
    if (!category.name || category.name.trim().length === 0) {
      throw new ValidationError('Category name is required');
    }
    return await this.categoryRepo.create(category);
  }
}
