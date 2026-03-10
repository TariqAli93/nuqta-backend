import { IProductRepository } from "../../interfaces/IProductRepository.js";
import { IInventoryRepository } from "../../interfaces/IInventoryRepository.js";
import type {
  StockReconciliationRow,
  StockReconciliationResult,
} from "../../interfaces/IInventoryRepository.js";

export type { StockReconciliationRow as StockDriftItem };

export interface ReconcileStockParams {
  /** Only return products with drift (default: true) */
  driftOnly?: boolean;
  /** Filter by product name */
  search?: string;
  /** Page size (default: 50) */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

export interface ReconcileStockResult {
  items: StockReconciliationRow[];
  total: number;
  totalDrift: number;
}

/**
 * Reconcile `products.stock` (cached projection) against the inventory
 * movements ledger (single source of truth).
 *
 * Delegates to an optimised single-query approach in the repository
 * layer to avoid N+1 queries and support pagination for large datasets.
 */
export class ReconcileStockUseCase {
  constructor(
    private productRepo: IProductRepository,
    private inventoryRepo: IInventoryRepository,
  ) {}

  async execute(params?: ReconcileStockParams): Promise<ReconcileStockResult> {
    return this.inventoryRepo.getStockReconciliation({
      driftOnly: params?.driftOnly ?? true,
      search: params?.search,
      limit: params?.limit,
      offset: params?.offset,
    });
  }

  /**
   * Batch-repair: update products.stock to match ledger in a single
   * UPDATE … FROM query. Returns the number of corrected rows.
   */
  async repair(): Promise<number> {
    return this.inventoryRepo.repairStockDrift();
  }
}
