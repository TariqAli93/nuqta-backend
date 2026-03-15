/**
 * CreateProductBatchUseCase
 * Creates a new batch for a product.
 */
import { IProductRepository } from "../../interfaces/IProductRepository.js";
import { NotFoundError, ValidationError } from "../../shared/errors/DomainErrors.js";
import type { ProductBatch } from "../../entities/ProductBatch.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

type TInput = { productId: number; data: Omit<ProductBatch, "id" | "productId"> };

export class CreateProductBatchUseCase extends WriteUseCase<TInput, ProductBatch, ProductBatch> {
  constructor(private productRepo: IProductRepository) {
    super();
  }

  async executeCommitPhase(
    input: TInput,
    _userId: string,
  ): Promise<ProductBatch> {
    const product = await this.productRepo.findById(input.productId);
    if (!product) {
      throw new NotFoundError("المنتج غير موجود");
    }

    if (!input.data.batchNumber || input.data.batchNumber.trim().length === 0) {
      throw new ValidationError("رقم الدفعة مطلوب");
    }

    return this.productRepo.createBatch({ ...input.data, productId: input.productId });
  }

  executeSideEffectsPhase(_result: ProductBatch, _userId: string): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: ProductBatch): ProductBatch {
    return result;
  }
}
