import type { Query } from "./Query.js";
import type { PaginatedResult } from "./PaginatedResult.js";
import type { Product } from "../../entities/Product.js";

export class GetProductsQuery implements Query<PaginatedResult<Product>> {
  constructor(
    readonly search?: string,
    readonly categoryId?: number,
    readonly supplierId?: number,
    readonly isActive?: boolean,
    readonly hasStock?: boolean,
    readonly hasExpiry?: boolean,
    readonly page: number = 1,
    readonly pageSize: number = 20,
  ) {}
}
