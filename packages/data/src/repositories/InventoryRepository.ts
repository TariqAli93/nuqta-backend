import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { DbConnection } from "../db.js";
import {
  inventoryMovements,
  products,
  productBatches,
} from "../schema/schema.js";
import { IInventoryRepository, InventoryMovement } from "@nuqta/core";

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
        gte(inventoryMovements.createdAt, new Date(params.dateFrom)),
      );
    if (params?.dateTo)
      conditions.push(
        lte(inventoryMovements.createdAt, new Date(params.dateTo)),
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
}
