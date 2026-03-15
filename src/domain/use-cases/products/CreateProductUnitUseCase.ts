/**
 * CreateProductUnitUseCase
 * Creates a new unit for a product.
 */
import { IProductRepository } from "../../interfaces/IProductRepository.js";
import { NotFoundError, ValidationError } from "../../shared/errors/DomainErrors.js";
import type { ProductUnit } from "../../entities/ProductUnit.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { productId: number; data: Omit<ProductUnit, "id" | "productId"> };

export class CreateProductUnitUseCase extends WriteUseCase<TInput, ProductUnit, ProductUnit> {
  constructor(private productRepo: IProductRepository) {
    super();
  }

  async executeCommitPhase(
    input: TInput,
    _userId: string,
  ): Promise<ProductUnit> {
    const product = await this.productRepo.findById(input.productId);
    if (!product) {
      throw new NotFoundError("المنتج غير موجود");
    }

    if (!input.data.unitName || input.data.unitName.trim().length === 0) {
      throw new ValidationError("اسم الوحدة مطلوب");
    }

    return this.productRepo.createUnit({ ...input.data, productId: input.productId });
  }

  executeSideEffectsPhase(_result: ProductUnit, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: ProductUnit): ProductUnit {
    return result;
  }
}
