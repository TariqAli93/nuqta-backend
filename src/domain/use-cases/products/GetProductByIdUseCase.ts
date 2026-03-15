/**
 * GetProductByIdUseCase
 * Fetches a single product by its ID.
 */
import { IProductRepository } from "../../interfaces/IProductRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";

export class GetProductByIdUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(id: number) {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError("المنتج غير موجود");
    }
    return product;
  }
}
