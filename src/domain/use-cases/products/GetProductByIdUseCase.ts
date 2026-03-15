/**
 * GetProductByIdUseCase
 * Fetches a single product by its ID.
 */
import { IProductRepository } from "../../interfaces/IProductRepository.js";
import { NotFoundError } from "../../shared/errors/DomainErrors.js";
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetProductByIdUseCase extends ReadUseCase<number, Awaited<ReturnType<IProductRepository["findById"]>>> {
  constructor(private productRepo: IProductRepository) {
    super();
  }

  async execute(id: number) {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new NotFoundError("المنتج غير موجود");
    }
    return product;
  }
}
