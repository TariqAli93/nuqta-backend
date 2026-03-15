import type { Query } from "./Query.js";
import type { PaginatedResult } from "./PaginatedResult.js";

// Supplier entity type (inline to avoid import issues)
export interface SupplierSummary {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  totalPurchases: number;
  totalDebt: number;
  isActive: boolean;
  createdAt: Date;
}

export class GetSuppliersQuery implements Query<PaginatedResult<SupplierSummary>> {
  constructor(
    readonly search?: string,
    readonly hasBalance?: boolean,
    readonly page: number = 1,
    readonly pageSize: number = 20,
  ) {}
}
