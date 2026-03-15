import type { Query } from "./Query.js";
import type { PaginatedResult } from "./PaginatedResult.js";
import type { Customer } from "../../entities/Customer.js";

export class GetCustomersQuery implements Query<PaginatedResult<Customer>> {
  constructor(
    readonly search?: string,
    readonly hasBalance?: boolean,
    readonly page: number = 1,
    readonly pageSize: number = 20,
  ) {}
}
