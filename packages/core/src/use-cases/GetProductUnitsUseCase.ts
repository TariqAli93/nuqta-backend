/**
 * GetProductUnitsUseCase
 * Lists all units for a product.
 */
import { IProductRepository } from "../interfaces/IProductRepository.js";

export class GetProductUnitsUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(productId: number) {
    return this.productRepo.findUnitsByProductId(productId);
  }
}
