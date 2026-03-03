/**
 * CreateProductBatchUseCase
 * Creates a new batch for a product.
 */
import { IProductRepository } from "../interfaces/IProductRepository.js";
import { NotFoundError, ValidationError } from "../errors/DomainErrors.js";
import type { ProductBatch } from "../entities/ProductBatch.js";

export class CreateProductBatchUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(
    productId: number,
    data: Omit<ProductBatch, "id" | "productId">,
  ): Promise<ProductBatch> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError("المنتج غير موجود");
    }

    if (!data.batchNumber || data.batchNumber.trim().length === 0) {
      throw new ValidationError("رقم الدفعة مطلوب");
    }

    return this.productRepo.createBatch({ ...data, productId });
  }
}
