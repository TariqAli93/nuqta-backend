import { ICategoryRepository } from '../../interfaces/ICategoryRepository.js';
import { Category } from '../../entities/Category.js';
import { ValidationError } from '../../shared/errors/DomainErrors.js';
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { id: number; category: Partial<Category> };

export class UpdateCategoryUseCase extends WriteUseCase<TInput, Category, Category> {
  constructor(private categoryRepo: ICategoryRepository) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<Category> {
    if (input.category.name !== undefined && input.category.name.trim().length === 0) {
      throw new ValidationError('Category name cannot be empty');
    }
    return await this.categoryRepo.update(input.id, input.category);
  }

  executeSideEffectsPhase(_result: Category, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: Category): Category {
    return result;
  }
}
