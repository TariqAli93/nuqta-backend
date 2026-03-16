import { ICategoryRepository } from '../../interfaces/ICategoryRepository.js';
import { Category } from '../../entities/Category.js';
import { ValidationError } from '../../shared/errors/DomainErrors.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export class CreateCategoryUseCase extends WriteUseCase<Category, Category, Category> {
  constructor(private categoryRepo: ICategoryRepository) {
    super();
  }

  async executeCommitPhase(category: Category, _userId: string): Promise<Category> {
    if (!category.name || category.name.trim().length === 0) {
      throw new ValidationError('Category name is required');
    }
    return await this.categoryRepo.create(category);
  }

  executeSideEffectsPhase(_result: Category, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Category): Category {
    return result;
  }
}
