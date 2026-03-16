import type { Query } from "./Query.js";
import type { PaginatedResult } from "./PaginatedResult.js";
import type { Purchase } from "../../entities/Purchase.js";

export class GetPurchasesQuery implements Query<PaginatedResult<Purchase>> {
  constructor(
    readonly supplierId?: number,
    readonly status?: string,
    readonly dateFrom?: string,
    readonly dateTo?: string,
    readonly page: number = 1,
    readonly pageSize: number = 20,
  ) {}
}
