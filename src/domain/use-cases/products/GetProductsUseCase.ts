import { IProductRepository } from '../../interfaces/IProductRepository.js';
import { Product } from '../../entities/Product.js';
import { ReadUseCase } from "../../shared/ReadUseCase.js";

export class GetProductsUseCase extends ReadUseCase<{
  search?: string;
  barcode?: string;
  page?: number;
  limit?: number;
  categoryId?: number;
  supplierId?: number;
  status?: string;
  lowStockOnly?: boolean;
  expiringSoonOnly?: boolean;
}, Awaited<ReturnType<IProductRepository["findAll"]>>> {
  constructor(private productRepo: IProductRepository) {
    super();
  }

  async execute(
    params: {
      search?: string;
      barcode?: string;
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
      barcode: params.barcode,
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
