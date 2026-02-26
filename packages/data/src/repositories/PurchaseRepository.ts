import { eq, and, like, gte, lte, sql, desc } from "drizzle-orm";
import { DbConnection } from "../db.js";
import {
  purchases,
  purchaseItems,
  payments,
  inventoryMovements,
  productBatches,
} from "../schema/schema.js";
import { IPurchaseRepository, Purchase } from "@nuqta/core";

export class PurchaseRepository implements IPurchaseRepository {
  constructor(private db: DbConnection) {}

  async create(purchase: Purchase): Promise<Purchase> {
    const { items, payments: _payments, movements, ...purchaseData } = purchase;

    const [created] = await this.db
      .insert(purchases)
      .values(purchaseData as any)
      .returning();

    if (items && items.length > 0) {
      const itemValues = items.map((item) => ({
        ...item,
        purchaseId: created.id,
      }));
      await this.db.insert(purchaseItems).values(itemValues as any);
    }

    return this.mapPurchaseWithDetails(created);
  }

  async createSync(purchase: Purchase): Promise<Purchase> {
    return this.create(purchase);
  }

  async findByIdempotencyKey(key: string): Promise<Purchase | null> {
    const [row] = await this.db
      .select()
      .from(purchases)
      .where(eq(purchases.idempotencyKey, key));
    if (!row) return null;
    return this.mapPurchaseWithDetails(row);
  }

  async findAll(params?: {
    search?: string;
    supplierId?: number;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Purchase[]; total: number }> {
    const conditions: any[] = [];
    if (params?.search)
      conditions.push(like(purchases.invoiceNumber, `%${params.search}%`));
    if (params?.supplierId)
      conditions.push(eq(purchases.supplierId, params.supplierId));
    if (params?.status) conditions.push(eq(purchases.status, params.status));
    if (params?.dateFrom)
      conditions.push(gte(purchases.createdAt, new Date(params.dateFrom)));
    if (params?.dateTo)
      conditions.push(lte(purchases.createdAt, new Date(params.dateTo)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(purchases)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db
      .select()
      .from(purchases)
      .where(where)
      .orderBy(desc(purchases.id))
      .$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    const items = await Promise.all(
      rows.map((row) => this.mapPurchaseWithDetails(row)),
    );
    return { items, total };
  }

  async findById(id: number): Promise<Purchase | null> {
    const [row] = await this.db
      .select()
      .from(purchases)
      .where(eq(purchases.id, id));
    if (!row) return null;
    return this.mapPurchaseWithDetails(row);
  }

  async findByIdSync(id: number): Promise<Purchase | null> {
    return this.findById(id);
  }

  async updateStatus(id: number, status: string): Promise<void> {
    await this.db
      .update(purchases)
      .set({ status, updatedAt: new Date() } as any)
      .where(eq(purchases.id, id));
  }

  async updateStatusSync(id: number, status: string): Promise<void> {
    return this.updateStatus(id, status);
  }

  async updatePayment(
    id: number,
    paidAmount: number,
    remainingAmount: number,
  ): Promise<void> {
    await this.db
      .update(purchases)
      .set({ paidAmount, remainingAmount, updatedAt: new Date() } as any)
      .where(eq(purchases.id, id));
  }

  async updatePaymentSync(
    id: number,
    paidAmount: number,
    remainingAmount: number,
  ): Promise<void> {
    return this.updatePayment(id, paidAmount, remainingAmount);
  }

  // ── Helpers ───────────────────────────────────────────────────

  private async mapPurchaseWithDetails(row: any): Promise<Purchase> {
    const items = await this.db
      .select()
      .from(purchaseItems)
      .where(eq(purchaseItems.purchaseId, row.id));

    // Enrich items with batch info
    const enrichedItems = await Promise.all(
      items.map(async (item) => {
        if (item.batchId) {
          const [batch] = await this.db
            .select()
            .from(productBatches)
            .where(eq(productBatches.id, item.batchId));
          return {
            ...item,
            batchNumber: batch?.batchNumber,
          };
        }
        return item;
      }),
    );

    const paymentRows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.purchaseId, row.id));

    const movementRows = await this.db
      .select()
      .from(inventoryMovements)
      .where(
        and(
          eq(inventoryMovements.sourceType, "purchase"),
          eq(inventoryMovements.sourceId, row.id),
        ),
      );

    return {
      ...row,
      items: enrichedItems,
      payments: paymentRows,
      movements: movementRows,
    } as Purchase;
  }
}
