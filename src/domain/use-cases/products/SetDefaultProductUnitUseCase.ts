/**
 * SetDefaultProductUnitUseCase
 * Marks a unit as the default for a product.
 */
import { IProductRepository } from "../../interfaces/IProductRepository.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { productId: number; unitId: number };

export class SetDefaultProductUnitUseCase extends WriteUseCase<TInput, void, void> {
  constructor(private productRepo: IProductRepository) {
    super();
  }

  async executeCommitPhase(input: TInput, _userId: string): Promise<void> {
    await this.productRepo.setDefaultUnit(input.productId, input.unitId);
  }

  executeSideEffectsPhase(_r: void, _u: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: void): void {
    return result;
  }
}
