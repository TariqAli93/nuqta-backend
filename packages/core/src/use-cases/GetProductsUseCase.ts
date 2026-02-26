import { IProductRepository } from '../interfaces/IProductRepository.js';
import { Product } from '../entities/Product.js';

export class GetProductsUseCase {
  constructor(private productRepo: IProductRepository) {}

  async execute(
    params: {
      search?: string;
      page?: number;
      limit?: number;
      categoryId?: number;
      supplierId?: number;
      status?: string;
      lowStockOnly?: boolean;
      expiringSoonOnly?: boolean;
    } = {}
  ) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;

    return this.productRepo.findAll({
      search: params.search,
      categoryId: params.categoryId,
      supplierId: params.supplierId,
      status: params.status,
      lowStockOnly: params.lowStockOnly,
      expiringSoonOnly: params.expiringSoonOnly,
      limit,
      offset,
    });
  }
}
