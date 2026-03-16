import { eq, and, gt, asc, sql } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import { productBatches } from "../../schema/schema.js";
import type {
  IFifoDepletionService,
  FifoDepletionResult,
  BatchDepletion,
} from "../../../domain/index.js";
import { OptimisticLockError } from "../../../domain/index.js";

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
    const MAX_LOCK_RETRIES = 3;

    for (const batch of batches) {
      if (remaining <= 0) break;

      // Optimistic locking: retry up to MAX_LOCK_RETRIES times if a concurrent
      // write changes the batch version between our SELECT and UPDATE.
      let currentBatch = batch;
      let lockAcquired = false;

      for (let attempt = 0; attempt < MAX_LOCK_RETRIES; attempt++) {
        const depleted = Math.min(remaining, currentBatch.quantityOnHand);
        const newQty = currentBatch.quantityOnHand - depleted;

        const result = await this.db
          .update(productBatches)
          .set({
            quantityOnHand: newQty,
            status: newQty <= 0 ? "depleted" : "active",
            version: sql`${productBatches.version} + 1`,
          } as any)
          .where(
            and(
              eq(productBatches.id, currentBatch.id),
              eq(productBatches.version, (currentBatch as any).version ?? 1),
            ),
          );

        const rowsAffected =
          (result as unknown as { rowCount?: number }).rowCount ?? 1;

        if (rowsAffected > 0) {
          depletions.push({
            batchId: currentBatch.id,
            batchNumber: currentBatch.batchNumber,
            quantity: depleted,
            costPerUnit: currentBatch.costPerUnit ?? 0,
            totalCost: depleted * (currentBatch.costPerUnit ?? 0),
          });
          remaining -= depleted;
          lockAcquired = true;
          break;
        }

        // Version mismatch: re-fetch the batch and retry
        if (attempt < MAX_LOCK_RETRIES - 1) {
          const [fresh] = await this.db
            .select()
            .from(productBatches)
            .where(
              and(
                eq(productBatches.id, currentBatch.id),
                gt(productBatches.quantityOnHand, 0),
                eq(productBatches.status, "active"),
              ),
            );
          if (!fresh) break; // batch fully depleted by another process
          currentBatch = fresh;
        }
      }

      if (!lockAcquired) {
        throw new OptimisticLockError(
          `Concurrent update detected on batch ${currentBatch.id} — retry the operation`,
          "product_batch",
        );
      }
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
