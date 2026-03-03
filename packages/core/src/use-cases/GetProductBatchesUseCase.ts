/**
 * GetProductBatchesUseCase
 * Lists all batches for a product.
 */
import { IProductRepository } from "../interfaces/IProductRepository.js";

export class GetProductBatchesUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(productId: number) {
    return this.productRepo.findBatchesByProductId(productId);
  }
}
