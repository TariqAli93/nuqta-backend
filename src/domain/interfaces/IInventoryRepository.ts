import { InventoryMovement } from "../entities/InventoryMovement.js";
import type { TxOrDb } from "../../data/db/transaction.js";

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
    tx?: TxOrDb,
  ): Promise<InventoryMovement>;
  createMovementSync(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
    tx?: TxOrDb,
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
  getExpiryAlerts(daysAhead?: number): Promise<any[]>;

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

  /**
   * Restore quantity to a batch (used during cancellation or refund).
   * Increments quantityOnHand and re-activates the batch if it was depleted.
   */
  restoreBatchQty(batchId: number, qty: number, tx?: TxOrDb): Promise<void>;
}
