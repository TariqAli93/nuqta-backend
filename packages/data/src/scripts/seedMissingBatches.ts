/**
 * Data correction: seed missing product batches.
 *
 * For every product where products.stock > 0 but no product_batches rows exist,
 * this creates an opening batch and a corresponding inventory_movement.
 *
 * Safe to run multiple times (idempotent) — it only acts on products with zero
 * batches.
 *
 * MUST be called inside an existing transaction or at startup before user
 * operations begin.
 */

import { eq, sql, and } from "drizzle-orm";
import { DbClient } from "../db.js";
import {
  products,
  productBatches,
  inventoryMovements,
} from "../schema/schema.js";

export interface SeedBatchResult {
  productId: number;
  batchId: number;
  quantity: number;
}

export async function seedMissingBatches(
  db: DbClient,
): Promise<SeedBatchResult[]> {
  // Find products with stock > 0 that have zero batches
  const orphans = await db
    .select({
      id: products.id,
      stock: products.stock,
      costPrice: products.costPrice,
      unit: products.unit,
    })
    .from(products)
    .where(
      and(
        sql`${products.stock} > 0`,
        sql`NOT EXISTS (
          SELECT 1 FROM product_batches pb
          WHERE pb.product_id = ${products.id}
        )`,
      ),
    );

  const results: SeedBatchResult[] = [];

  for (const orphan of orphans) {
    const qty = orphan.stock ?? 0;
    if (qty <= 0) continue;

    const costPerUnit = orphan.costPrice ?? 0;
    const batchNumber = `OPENING-${orphan.id}`;

    // Create opening batch
    const [batch] = await db
      .insert(productBatches)
      .values({
        productId: orphan.id,
        batchNumber,
        quantityReceived: qty,
        quantityOnHand: qty,
        costPerUnit,
        status: "active",
      } as any)
      .returning();

    // Create inventory movement referencing the batch
    await db.insert(inventoryMovements).values({
      productId: orphan.id,
      batchId: batch.id,
      movementType: "adjust",
      reason: "opening",
      quantityBase: qty,
      unitName: orphan.unit || "piece",
      unitFactor: 1,
      stockBefore: 0,
      stockAfter: qty,
      costPerUnit,
      totalCost: qty * costPerUnit,
      sourceType: "adjustment",
      notes: "Auto-created opening batch for ERP FIFO compatibility",
      createdBy: 1,
    } as any);

    results.push({
      productId: orphan.id,
      batchId: batch.id,
      quantity: qty,
    });
  }

  return results;
}
