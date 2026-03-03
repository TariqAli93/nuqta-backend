/**
 * DeleteProductUnitUseCase
 * Removes a unit from a product.
 */
import { IProductRepository } from "../interfaces/IProductRepository.js";

export class DeleteProductUnitUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(unitId: number): Promise<void> {
    await this.productRepo.deleteUnit(unitId);
  }
}
