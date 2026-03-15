/**
 * UpdateProductUnitUseCase
 * Updates an existing unit.
 */
import { IProductRepository } from "../../interfaces/IProductRepository.js";
import type { ProductUnit } from "../../entities/ProductUnit.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { unitId: number; data: Partial<Omit<ProductUnit, "id" | "productId">> };

export class UpdateProductUnitUseCase extends WriteUseCase<TInput, ProductUnit, ProductUnit> {
  constructor(private productRepo: IProductRepository) {
    super();
  }

  async executeCommitPhase(
    input: TInput,
    _userId: string,
  ): Promise<ProductUnit> {
    return this.productRepo.updateUnit(input.unitId, input.data);
  }

  executeSideEffectsPhase(_result: ProductUnit, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: ProductUnit): ProductUnit {
    return result;
  }
}
