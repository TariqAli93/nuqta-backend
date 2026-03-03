/**
 * CreateProductUnitUseCase
 * Creates a new unit for a product.
 */
import { IProductRepository } from "../interfaces/IProductRepository.js";
import { NotFoundError, ValidationError } from "../errors/DomainErrors.js";
import type { ProductUnit } from "../entities/ProductUnit.js";

export class CreateProductUnitUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(
    productId: number,
    data: Omit<ProductUnit, "id" | "productId">,
  ): Promise<ProductUnit> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new NotFoundError("المنتج غير موجود");
    }

    if (!data.unitName || data.unitName.trim().length === 0) {
      throw new ValidationError("اسم الوحدة مطلوب");
    }

    return this.productRepo.createUnit({ ...data, productId });
  }
}
