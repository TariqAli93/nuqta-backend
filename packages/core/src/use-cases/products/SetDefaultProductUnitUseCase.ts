/**
 * SetDefaultProductUnitUseCase
 * Marks a unit as the default for a product.
 */
import { IProductRepository } from "../../interfaces/IProductRepository.js";

export class SetDefaultProductUnitUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(productId: number, unitId: number): Promise<void> {
    await this.productRepo.setDefaultUnit(productId, unitId);
  }
}
