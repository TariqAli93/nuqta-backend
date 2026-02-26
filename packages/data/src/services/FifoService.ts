import { eq, and, gt, asc, sql } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { productBatches } from "../schema/schema.js";
import type {
  IFifoDepletionService,
  FifoDepletionResult,
  BatchDepletion,
} from "@nuqta/core";

/**
 * FIFO Depletion Service for PostgreSQL.
 *
 * Depletes stock from product batches in FIFO order (oldest first)
 * with FEFO tie-breaking (earliest expiry first).
 */
export class FifoService implements IFifoDepletionService {
  constructor(private db: DbConnection) {}

  async deplete(
    productId: number,
    quantityNeeded: number,
  ): Promise<FifoDepletionResult> {
    // Get active batches with stock, ordered by FEFO then FIFO
    const batches = await this.db
      .select()
      .from(productBatches)
      .where(
        and(
          eq(productBatches.productId, productId),
          gt(productBatches.quantityOnHand, 0),
          eq(productBatches.status, "active"),
        ),
      )
      .orderBy(
        // Batches with expiry come first, then earliest expiry, then oldest id
        sql`CASE WHEN ${productBatches.expiryDate} IS NOT NULL THEN 0 ELSE 1 END`,
        asc(productBatches.expiryDate),
        asc(productBatches.id),
      );

    const depletions: BatchDepletion[] = [];
    let remaining = quantityNeeded;

    for (const batch of batches) {
      if (remaining <= 0) break;

      const depleted = Math.min(remaining, batch.quantityOnHand);
      const newQty = batch.quantityOnHand - depleted;

      // Update batch stock
      await this.db
        .update(productBatches)
        .set({
          quantityOnHand: newQty,
          status: newQty <= 0 ? "depleted" : "active",
        } as any)
        .where(eq(productBatches.id, batch.id));

      depletions.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: depleted,
        costPerUnit: batch.costPerUnit ?? 0,
        totalCost: depleted * (batch.costPerUnit ?? 0),
      });

      remaining -= depleted;
    }

    const totalCost = depletions.reduce((s, d) => s + d.totalCost, 0);
    const totalQty = depletions.reduce((s, d) => s + d.quantity, 0);
    const weightedAverageCost =
      totalQty > 0 ? Math.round(totalCost / totalQty) : 0;

    return { depletions, totalCost, weightedAverageCost };
  }

  async getAvailableStock(productId: number): Promise<number> {
    const [result] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${productBatches.quantityOnHand}), 0)`,
      })
      .from(productBatches)
      .where(
        and(
          eq(productBatches.productId, productId),
          eq(productBatches.status, "active"),
        ),
      );
    return Number(result?.total ?? 0);
  }
}
