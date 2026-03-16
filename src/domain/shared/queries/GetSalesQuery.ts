import type { Query } from "./Query.js";
import type { PaginatedResult } from "./PaginatedResult.js";
import type { Sale } from "../../entities/Sale.js";

export class GetSalesQuery implements Query<PaginatedResult<Sale>> {
  constructor(
    readonly status?: string,
    readonly customerId?: number,
    readonly dateFrom?: string,
    readonly dateTo?: string,
    readonly page: number = 1,
    readonly pageSize: number = 20,
  ) {}
}
