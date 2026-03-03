/**
 * UpdateProductUnitUseCase
 * Updates an existing unit.
 */
import { IProductRepository } from "../interfaces/IProductRepository.js";
import type { ProductUnit } from "../entities/ProductUnit.js";

export class UpdateProductUnitUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(
    unitId: number,
    data: Partial<Omit<ProductUnit, "id" | "productId">>,
  ): Promise<ProductUnit> {
    return this.productRepo.updateUnit(unitId, data);
  }
}
