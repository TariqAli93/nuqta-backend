import { eq, and, gte, lte, sql, desc, SQL } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import type { TxOrDb } from "../../db/transaction.js";
import {
  inventoryMovements,
  products,
  productBatches,
} from "../../schema/schema.js";
import {
  IInventoryRepository,
  InventoryMovement,
  StockReconciliationResult,
} from "../../../domain/index.js";

/* ──────────────────────────────────────────────────────────────────
 * Shared helpers
 * ────────────────────────────────────────────────────────────────── */

/** Reusable WHERE fragment for "batches expiring within N days". */
function expiringBatchesCondition(days = 30): SQL {
  return and(
    sql`${productBatches.quantityOnHand} > 0`,
    sql`${productBatches.expiryDate} IS NOT NULL`,
    sql`${productBatches.expiryDate}::date <= CURRENT_DATE + INTERVAL '${sql.raw(String(days))} days'`,
    sql`${productBatches.expiryDate}::date >= CURRENT_DATE`,
  )!;
}

/** Ledger SUM expression reused by reconciliation + repair. */
const LEDGER_SUM_EXPR = sql`
  SUM(CASE
    WHEN movement_type = 'in'     THEN quantity_base
    WHEN movement_type = 'out'    THEN -quantity_base
    WHEN movement_type = 'adjust' THEN quantity_base
    ELSE 0
  END)`;

/* ──────────────────────────────────────────────────────────────────
 * Repository
 * ────────────────────────────────────────────────────────────────── */

export class InventoryRepository implements IInventoryRepository {
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  /* ── Movements ──────────────────────────────────────────────── */

  async createMovement(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<InventoryMovement> {
    const [created] = await this.c(tx)
      .insert(inventoryMovements)
      .values(movement as typeof inventoryMovements.$inferInsert)
      .returning();
    return created as InventoryMovement;
  }

  /**
   * @deprecated Alias kept for interface compat — just delegates to
   * the async `createMovement`.  Remove once call-sites are updated.
   */
  async createMovementSync(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<InventoryMovement> {
    return this.createMovement(movement, tx);
  }

  async restoreBatchQty(
    batchId: number,
    qty: number,
    tx?: TxOrDb,
  ): Promise<void> {
    await this.c(tx)
      .update(productBatches)
      .set({
        quantityOnHand: sql`${productBatches.quantityOnHand} + ${qty}`,
        isActive: true,
      } as any)
      .where(eq(productBatches.id, batchId));

    // Keep products.stock in sync
    const [batch] = await this.c(tx)
      .select({ productId: productBatches.productId })
      .from(productBatches)
      .where(eq(productBatches.id, batchId));

    if (batch?.productId) {
      await this.c(tx)
        .update(products)
        .set({ stock: sql`${products.stock} + ${qty}` } as any)
        .where(eq(products.id, batch.productId));
    }
  }

  async getMovements(params?: {
    productId?: number;
    movementType?: string;
    sourceType?: string;
    sourceId?: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: InventoryMovement[]; total: number }> {
    const conditions: SQL[] = [];

    if (params?.productId)
      conditions.push(eq(inventoryMovements.productId, params.productId));
    if (params?.movementType)
      conditions.push(eq(inventoryMovements.movementType, params.movementType));
    if (params?.sourceType)
      conditions.push(eq(inventoryMovements.sourceType, params.sourceType));
    if (params?.sourceId)
      conditions.push(eq(inventoryMovements.sourceId, params.sourceId));

    // Compare date strings directly — the input is already in local date
    // format (YYYY-MM-DD) and the DB column stores timestamptz, so we
    // cast the column to DATE to avoid UTC-shift mismatches.
    if (params?.dateFrom)
      conditions.push(
        gte(sql`${inventoryMovements.createdAt}::date`, params.dateFrom),
      );
    if (params?.dateTo)
      conditions.push(
        lte(sql`${inventoryMovements.createdAt}::date`, params.dateTo),
      );

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryMovements)
      .where(where);
    const total = Number(countRow?.count ?? 0);

    let query = this.db
      .select()
      .from(inventoryMovements)
      .where(where)
      .orderBy(desc(inventoryMovements.id))
      .$dynamic();

    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    return { items: rows as InventoryMovement[], total };
  }

  /* ── Dashboard ──────────────────────────────────────────────── */

  async getDashboardStats(): Promise<{
    totalValuation: number;
    lowStockCount: number;
    expiryAlertCount: number;
    topMovingProducts: {
      productId: number;
      productName: string;
      totalQuantity: number;
    }[];
  }> {
    // Total valuation
    const [valuationRow] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${products.stock} * ${products.costPrice}), 0)`,
      })
      .from(products)
      .where(eq(products.isActive, true));

    // Low stock count
    const [lowStockRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
          eq(products.isActive, true),
          sql`${products.stock} <= ${products.minStock}`,
          sql`${products.minStock} > 0`,
        ),
      );

    // Expiry alert count — uses shared condition
    const [expiryRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productBatches)
      .where(expiringBatchesCondition());

    // Top moving products — single query with JOIN (no N+1)
    const topMovingProducts = await this.db
      .select({
        productId: inventoryMovements.productId,
        productName: products.name,
        totalQuantity: sql<number>`SUM(ABS(${inventoryMovements.quantityBase}))`,
      })
      .from(inventoryMovements)
      .innerJoin(products, eq(products.id, inventoryMovements.productId))
      .where(
        sql`${inventoryMovements.createdAt} >= CURRENT_DATE - INTERVAL '30 days'`,
      )
      .groupBy(inventoryMovements.productId, products.name)
      .orderBy(sql`SUM(ABS(${inventoryMovements.quantityBase})) DESC`)
      .limit(5);

    return {
      totalValuation: Number(valuationRow?.total ?? 0),
      lowStockCount: Number(lowStockRow?.count ?? 0),
      expiryAlertCount: Number(expiryRow?.count ?? 0),
      topMovingProducts: topMovingProducts.map((r) => ({
        productId: r.productId,
        productName: r.productName ?? "Unknown",
        totalQuantity: Number(r.totalQuantity),
      })),
    };
  }

  /* ── Expiry alerts ──────────────────────────────────────────── */

  async getExpiryAlerts(daysAhead = 30): Promise<
    {
      batchId: number;
      productId: number;
      productName: string;
      batchNumber: string | null;
      expiryDate: string | null;
      quantityOnHand: number;
    }[]
  > {
    // Single query with JOIN — no N+1
    const rows = await this.db
      .select({
        batchId: productBatches.id,
        productId: productBatches.productId,
        productName: products.name,
        batchNumber: productBatches.batchNumber,
        expiryDate: productBatches.expiryDate,
        quantityOnHand: productBatches.quantityOnHand,
      })
      .from(productBatches)
      .innerJoin(products, eq(products.id, productBatches.productId))
      .where(expiringBatchesCondition(daysAhead))
      .orderBy(productBatches.expiryDate);

    return rows.map((r) => ({
      batchId: r.batchId,
      productId: r.productId,
      productName: r.productName ?? "Unknown",
      batchNumber: r.batchNumber,
      expiryDate: r.expiryDate,
      quantityOnHand: Number(r.quantityOnHand),
    }));
  }

  /* ── Stock Reconciliation ───────────────────────────────────── */

  async getStockReconciliation(params?: {
    driftOnly?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<StockReconciliationResult> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const driftOnly = params?.driftOnly ?? true;

    // Sub-query: sum movements per product
    const ledgerSub = this.db
      .select({
        productId: inventoryMovements.productId,
        ledgerStock: sql<number>`
          SUM(CASE
            WHEN ${inventoryMovements.movementType} = 'in'     THEN ${inventoryMovements.quantityBase}
            WHEN ${inventoryMovements.movementType} = 'out'    THEN -${inventoryMovements.quantityBase}
            WHEN ${inventoryMovements.movementType} = 'adjust' THEN ${inventoryMovements.quantityBase}
            ELSE 0
          END)`.as("ledger_stock"),
      })
      .from(inventoryMovements)
      .groupBy(inventoryMovements.productId)
      .as("ledger");

    const conditions: SQL[] = [eq(products.isActive, true)];

    if (params?.search) {
      conditions.push(sql`${products.name} ILIKE ${"%" + params.search + "%"}`);
    }

    if (driftOnly) {
      conditions.push(
        sql`COALESCE(${products.stock}, 0) != COALESCE(${ledgerSub.ledgerStock}, 0)`,
      );
    }

    const where = and(...conditions);

    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .leftJoin(ledgerSub, eq(products.id, ledgerSub.productId))
      .where(where);

    const [driftSumRow] = await this.db
      .select({
        totalDrift: sql<number>`COALESCE(SUM(ABS(
          COALESCE(${products.stock}, 0) - COALESCE(${ledgerSub.ledgerStock}, 0)
        )), 0)`,
      })
      .from(products)
      .leftJoin(ledgerSub, eq(products.id, ledgerSub.productId))
      .where(where);

    const rows = await this.db
      .select({
        productId: products.id,
        productName: products.name,
        cachedStock: sql<number>`COALESCE(${products.stock}, 0)`,
        ledgerStock: sql<number>`COALESCE(${ledgerSub.ledgerStock}, 0)`,
        drift: sql<number>`COALESCE(${products.stock}, 0) - COALESCE(${ledgerSub.ledgerStock}, 0)`,
      })
      .from(products)
      .leftJoin(ledgerSub, eq(products.id, ledgerSub.productId))
      .where(where)
      .orderBy(products.id)
      .limit(limit)
      .offset(offset);

    return {
      items: rows.map((r) => ({
        productId: r.productId,
        productName: r.productName,
        cachedStock: Number(r.cachedStock),
        ledgerStock: Number(r.ledgerStock),
        drift: Number(r.drift),
      })),
      total: Number(countRow?.count ?? 0),
      totalDrift: Number(driftSumRow?.totalDrift ?? 0),
    };
  }

  /* ── Drift repair ───────────────────────────────────────────── */

  async repairStockDrift(): Promise<number> {
    // Uses a LEFT JOIN so products with zero movements get stock → 0.
    // The original INNER JOIN silently skipped those products.
    const result = await this.db.execute(sql`
      UPDATE products AS p
      SET stock = COALESCE(m.ledger_stock, 0)
      FROM (
        SELECT
          pr.id AS product_id,
          COALESCE(mv.ledger_stock, 0) AS ledger_stock
        FROM products pr
        LEFT JOIN (
          SELECT
            product_id,
            ${LEDGER_SUM_EXPR} AS ledger_stock
          FROM inventory_movements
          GROUP BY product_id
        ) mv ON mv.product_id = pr.id
        WHERE pr.is_active = true
          AND COALESCE(pr.stock, 0) != COALESCE(mv.ledger_stock, 0)
      ) m
      WHERE p.id = m.product_id
    `);

    return Number((result as { rowCount?: number }).rowCount ?? 0);
  }
}
