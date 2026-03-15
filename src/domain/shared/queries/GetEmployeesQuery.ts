import type { Query } from "./Query.js";
import type { PaginatedResult } from "./PaginatedResult.js";
import type { Employee } from "../../entities/Employee.js";

export class GetEmployeesQuery implements Query<PaginatedResult<Employee>> {
  constructor(
    readonly search?: string,
    readonly department?: string,
    readonly isActive?: boolean,
    readonly page: number = 1,
    readonly pageSize: number = 20,
  ) {}
}
