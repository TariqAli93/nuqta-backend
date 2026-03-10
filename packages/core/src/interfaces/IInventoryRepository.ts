import { InventoryMovement } from "../entities/InventoryMovement.js";
import { Product } from "../entities/Product.js";

export interface StockReconciliationRow {
  productId: number;
  productName: string;
  cachedStock: number;
  ledgerStock: number;
  drift: number;
}

export interface StockReconciliationResult {
  items: StockReconciliationRow[];
  total: number;
  totalDrift: number;
}

export interface IInventoryRepository {
  createMovement(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
  ): Promise<InventoryMovement>;
  createMovementSync(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
  ): Promise<InventoryMovement>;
  getMovements(params?: {
    productId?: number;
    movementType?: string;
    sourceType?: string;
    sourceId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InventoryMovement[]; total: number }>;
  getDashboardStats(): Promise<{
    totalValuation: number;
    lowStockCount: number;
    expiryAlertCount: number;
    topMovingProducts: any[];
  }>;
  getExpiryAlerts(): Promise<any[]>;

  /**
   * Compare products.stock (cached) against SUM of inventory_movements
   * (ledger) in a single efficient query. Supports pagination and
   * optional drift-only filtering.
   */
  getStockReconciliation(params?: {
    driftOnly?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<StockReconciliationResult>;

  /**
   * Batch-repair: set products.stock = ledger SUM for all drifted products.
   * Returns count of corrected rows.
   */
  repairStockDrift(): Promise<number>;
}
