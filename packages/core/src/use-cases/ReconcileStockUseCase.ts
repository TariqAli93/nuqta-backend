import { IProductRepository } from "../interfaces/IProductRepository.js";
import { IInventoryRepository } from "../interfaces/IInventoryRepository.js";

export interface StockDriftItem {
  productId: number;
  productName: string;
  cachedStock: number;
  ledgerStock: number;
  drift: number;
}

export interface ReconcileStockResult {
  driftItems: StockDriftItem[];
  totalProducts: number;
  totalDrift: number;
}

/**
 * Reconcile `products.stock` (cached projection) against the inventory
 * movements ledger (single source of truth).
 *
 * Use this after suspected data inconsistencies, power failures, or
 * ad-hoc debugging sessions.
 */
export class ReconcileStockUseCase {
  constructor(
    private productRepo: IProductRepository,
    private inventoryRepo: IInventoryRepository,
  ) {}

  async execute(): Promise<ReconcileStockResult> {
    const { items: products } = await this.productRepo.findAll();
    const driftItems: StockDriftItem[] = [];
    let totalDrift = 0;

    for (const product of products) {
      if (!product.id) continue;

      const { items: movements } = await this.inventoryRepo.getMovements({
        productId: product.id,
      });

      // Sum ledger: 'in' adds, 'out' subtracts, 'adjust' is delta
      let ledgerStock = 0;
      for (const mov of movements) {
        if (mov.movementType === "in") {
          ledgerStock += mov.quantityBase;
        } else if (mov.movementType === "out") {
          ledgerStock -= mov.quantityBase;
        } else if (mov.movementType === "adjust") {
          ledgerStock += mov.quantityBase; // adjust can be positive or negative
        }
      }

      const drift = (product.stock || 0) - ledgerStock;
      if (drift !== 0) {
        driftItems.push({
          productId: product.id,
          productName: product.name,
          cachedStock: product.stock || 0,
          ledgerStock,
          drift,
        });
        totalDrift += Math.abs(drift);
      }
    }

    return {
      driftItems,
      totalProducts: products.length,
      totalDrift,
    };
  }

  /**
   * Repair stock cache to match the ledger.
   * Returns the number of products corrected.
   */
  async repair(): Promise<number> {
    const { driftItems } = await this.execute();
    let corrected = 0;

    for (const item of driftItems) {
      await this.productRepo.updateStock(
        item.productId,
        item.ledgerStock - item.cachedStock,
      );
      corrected++;
    }

    return corrected;
  }
}
