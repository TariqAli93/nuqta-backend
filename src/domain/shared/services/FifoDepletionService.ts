// ═══════════════════════════════════════════════════════════════
// FIFO Depletion Service — Core Interface
// Batch-level stock depletion using First-In-First-Out ordering
// with First-Expiry-First-Out (FEFO) tie-breaking.
// ═══════════════════════════════════════════════════════════════

export interface BatchDepletion {
  /** Batch that was depleted */
  batchId: number;
  /** Batch number reference */
  batchNumber: string;
  /** Quantity taken from this batch (base units) */
  quantity: number;
  /** Cost per unit for this batch */
  costPerUnit: number;
  /** Total cost for depletion from this batch */
  totalCost: number;
}

export interface FifoDepletionResult {
  /** Individual batch depletions performed */
  depletions: BatchDepletion[];
  /** Total COGS from all depletions */
  totalCost: number;
  /** Weighted average cost per unit across all depletions */
  weightedAverageCost: number;
}

/**
 * FIFO depletion service for batch-level inventory tracking.
 *
 * Ordering guarantee:
 *   1. Batches with expiry dates come before non-expiry batches
 *   2. Among batches with expiry dates, earliest expiry first (FEFO)
 *   3. Among same-expiry batches, lowest id first (first received = FIFO)
 *
 * MUST be called inside a withTransaction() block.
 */
export interface IFifoDepletionService {
  /**
   * Deplete stock from oldest/soonest-expiring batches first.
   * Updates product_batches.quantity_on_hand and status atomically.
   *
   * @throws InsufficientStockError if total batch stock < quantityNeeded
   */
  deplete(
    productId: number,
    quantityNeeded: number,
  ): Promise<FifoDepletionResult>;

  /**
   * Get total available batch stock for a product
   * (sum of quantity_on_hand for active batches).
   */
  getAvailableStock(productId: number): Promise<number>;
}
