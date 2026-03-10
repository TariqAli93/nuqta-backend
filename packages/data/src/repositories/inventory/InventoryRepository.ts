import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import {
  inventoryMovements,
  products,
  productBatches,
} from "../../schema/schema.js";
import {
  IInventoryRepository,
  InventoryMovement,
  StockReconciliationResult,
} from "@nuqta/core";

export class InventoryRepository implements IInventoryRepository {
  constructor(private db: DbConnection) {}

  async createMovement(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
  ): Promise<InventoryMovement> {
    const [created] = await this.db
      .insert(inventoryMovements)
      .values(movement as any)
      .returning();
    return created as unknown as InventoryMovement;
  }

  async createMovementSync(
    movement: Omit<InventoryMovement, "id" | "createdAt">,
  ): Promise<InventoryMovement> {
    return this.createMovement(movement);
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
    const conditions: any[] = [];
    if (params?.productId)
      conditions.push(eq(inventoryMovements.productId, params.productId));
    if (params?.movementType)
      conditions.push(eq(inventoryMovements.movementType, params.movementType));
    if (params?.sourceType)
      conditions.push(eq(inventoryMovements.sourceType, params.sourceType));
    if (params?.sourceId)
      conditions.push(eq(inventoryMovements.sourceId, params.sourceId));
    if (params?.dateFrom)
      conditions.push(
        gte(
          inventoryMovements.createdAt,
          new Date(params.dateFrom).toISOString(),
        ),
      );
    if (params?.dateTo)
      conditions.push(
        lte(
          inventoryMovements.createdAt,
          new Date(params.dateTo).toISOString(),
        ),
      );

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(inventoryMovements)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db
      .select()
      .from(inventoryMovements)
      .where(where)
      .orderBy(desc(inventoryMovements.id))
      .$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    return { items: rows as unknown as InventoryMovement[], total };
  }

  async getDashboardStats(): Promise<{
    totalValuation: number;
    lowStockCount: number;
    expiryAlertCount: number;
    topMovingProducts: any[];
  }> {
    // Total valuation: sum(stock * costPrice) for all active products
    const [valuationRow] = await this.db
      .select({
        total: sql<number>`COALESCE(SUM(${products.stock} * ${products.costPrice}), 0)`,
      })
      .from(products)
      .where(eq(products.isActive, true));
    const totalValuation = Number(valuationRow?.total ?? 0);

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
    const lowStockCount = Number(lowStockRow?.count ?? 0);

    // Expiry alerts: batches expiring within 30 days
    const [expiryRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(productBatches)
      .where(
        and(
          sql`${productBatches.quantityOnHand} > 0`,
          sql`${productBatches.expiryDate} IS NOT NULL`,
          sql`${productBatches.expiryDate}::date <= CURRENT_DATE + INTERVAL '30 days'`,
          sql`${productBatches.expiryDate}::date >= CURRENT_DATE`,
        ),
      );
    const expiryAlertCount = Number(expiryRow?.count ?? 0);

    // Top moving products (by total movement quantity, last 30 days)
    const topMoving = await this.db
      .select({
        productId: inventoryMovements.productId,
        totalQty: sql<number>`SUM(ABS(${inventoryMovements.quantityBase}))`,
      })
      .from(inventoryMovements)
      .where(
        sql`${inventoryMovements.createdAt} >= CURRENT_DATE - INTERVAL '30 days'`,
      )
      .groupBy(inventoryMovements.productId)
      .orderBy(sql`SUM(ABS(${inventoryMovements.quantityBase})) DESC`)
      .limit(5);

    const topMovingProducts = await Promise.all(
      topMoving.map(async (tm) => {
        const [product] = await this.db
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, tm.productId));
        return {
          productId: tm.productId,
          productName: product?.name ?? "Unknown",
          totalQuantity: Number(tm.totalQty),
        };
      }),
    );

    return {
      totalValuation,
      lowStockCount,
      expiryAlertCount,
      topMovingProducts,
    };
  }

  async getExpiryAlerts(): Promise<any[]> {
    const rows = await this.db
      .select({
        batchId: productBatches.id,
        productId: productBatches.productId,
        batchNumber: productBatches.batchNumber,
        expiryDate: productBatches.expiryDate,
        quantityOnHand: productBatches.quantityOnHand,
      })
      .from(productBatches)
      .where(
        and(
          sql`${productBatches.quantityOnHand} > 0`,
          sql`${productBatches.expiryDate} IS NOT NULL`,
          sql`${productBatches.expiryDate}::date <= CURRENT_DATE + INTERVAL '30 days'`,
          sql`${productBatches.expiryDate}::date >= CURRENT_DATE`,
        ),
      )
      .orderBy(productBatches.expiryDate);

    return Promise.all(
      rows.map(async (row) => {
        const [product] = await this.db
          .select({ name: products.name })
          .from(products)
          .where(eq(products.id, row.productId));
        return {
          ...row,
          productName: product?.name ?? "Unknown",
        };
      }),
    );
  }

  /* ────────────────────────────────────────────────────────────────
   * Stock Reconciliation — optimised single-query approach
   * ──────────────────────────────────────────────────────────────── */

  async getStockReconciliation(params?: {
    driftOnly?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<StockReconciliationResult> {
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    const driftOnly = params?.driftOnly ?? true;

    // Sub-query: sum movements per product in a single pass
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

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [eq(products.isActive, true)];

    if (params?.search) {
      conditions.push(
        sql`${products.name} ILIKE ${"%" + params.search + "%"}` as any,
      );
    }

    if (driftOnly) {
      conditions.push(
        sql`COALESCE(${products.stock}, 0) != COALESCE(${ledgerSub.ledgerStock}, 0)` as any,
      );
    }

    const where = and(...conditions);

    // Count query (total matching rows)
    const [countRow] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(products)
      .leftJoin(ledgerSub, eq(products.id, ledgerSub.productId))
      .where(where);
    const total = Number(countRow?.count ?? 0);

    // Sum of absolute drift for summary
    const [driftSumRow] = await this.db
      .select({
        totalDrift: sql<number>`COALESCE(SUM(ABS(COALESCE(${products.stock}, 0) - COALESCE(${ledgerSub.ledgerStock}, 0))), 0)`,
      })
      .from(products)
      .leftJoin(ledgerSub, eq(products.id, ledgerSub.productId))
      .where(where);
    const totalDrift = Number(driftSumRow?.totalDrift ?? 0);

    // Data query with pagination, ordered by product id for stable keyset
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
      total,
      totalDrift,
    };
  }

  async repairStockDrift(): Promise<number> {
    // Single UPDATE … FROM (sub-query) — no N+1
    const result = await this.db.execute(sql`
      UPDATE products AS p
      SET stock = COALESCE(m.ledger_stock, 0)
      FROM (
        SELECT
          product_id,
          SUM(CASE
            WHEN movement_type = 'in'     THEN quantity_base
            WHEN movement_type = 'out'    THEN -quantity_base
            WHEN movement_type = 'adjust' THEN quantity_base
            ELSE 0
          END) AS ledger_stock
        FROM inventory_movements
        GROUP BY product_id
      ) m
      WHERE p.id = m.product_id
        AND p.is_active = true
        AND COALESCE(p.stock, 0) != COALESCE(m.ledger_stock, 0)
    `);

    return Number((result as any).rowCount ?? (result as any).length ?? 0);
  }
}
