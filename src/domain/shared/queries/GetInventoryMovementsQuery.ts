import type { Query } from "./Query.js";
import type { PaginatedResult } from "./PaginatedResult.js";
import type { InventoryMovement } from "../../entities/InventoryMovement.js";

export class GetInventoryMovementsQuery
  implements Query<PaginatedResult<InventoryMovement>>
{
  constructor(
    readonly productId?: number,
    readonly type?: string,
    readonly dateFrom?: string,
    readonly dateTo?: string,
    readonly page: number = 1,
    readonly pageSize: number = 20,
  ) {}
}
