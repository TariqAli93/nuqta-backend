import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { DbConnection } from "../db.js";
import {
  sales,
  saleItems,
  saleItemDepletions,
  productBatches,
} from "../schema/schema.js";
import { ISaleRepository, Sale, SaleItemDepletion } from "@nuqta/core";

export class SaleRepository implements ISaleRepository {
  constructor(private db: DbConnection) {}

  async create(sale: Sale): Promise<Sale> {
    const { items, ...saleData } = sale;

    const [created] = await this.db
      .insert(sales)
      .values(saleData as any)
      .returning();

    if (items && items.length > 0) {
      const itemValues = items.map((item) => ({
        ...item,
        saleId: created.id,
      }));
      await this.db.insert(saleItems).values(itemValues as any);
    }

    return this.mapSaleWithDetails(created);
  }

  async findById(id: number): Promise<Sale | null> {
    const [row] = await this.db.select().from(sales).where(eq(sales.id, id));
    if (!row) return null;
    return this.mapSaleWithDetails(row);
  }

  async findByIdempotencyKey(key: string): Promise<Sale | null> {
    const [row] = await this.db
      .select()
      .from(sales)
      .where(eq(sales.idempotencyKey, key));
    if (!row) return null;
    return this.mapSaleWithDetails(row);
  }

  async findAll(params?: {
    page: number;
    limit: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: Sale[]; total: number }> {
    const conditions: any[] = [];
    if (params?.startDate)
      conditions.push(gte(sales.createdAt, new Date(params.startDate)));
    if (params?.endDate)
      conditions.push(lte(sales.createdAt, new Date(params.endDate)));

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(sales)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    const page = params?.page ?? 1;
    const limit = params?.limit ?? 20;
    const offset = (page - 1) * limit;

    const rows = await this.db
      .select()
      .from(sales)
      .where(where)
      .orderBy(desc(sales.id))
      .limit(limit)
      .offset(offset);

    const items = await Promise.all(
      rows.map((row) => this.mapSaleWithDetails(row)),
    );
    return { items, total };
  }

  async updateStatus(
    id: number,
    status: "completed" | "cancelled",
  ): Promise<void> {
    await this.db
      .update(sales)
      .set({ status, updatedAt: new Date() } as any)
      .where(eq(sales.id, id));
  }

  async update(id: number, data: Partial<Sale>): Promise<void> {
    const { items, ...saleData } = data;
    await this.db
      .update(sales)
      .set({ ...saleData, updatedAt: new Date() } as any)
      .where(eq(sales.id, id));
  }

  async createItemDepletions(
    depletions: Omit<
      SaleItemDepletion,
      "id" | "createdAt" | "batchNumber" | "expiryDate"
    >[],
  ): Promise<void> {
    if (depletions.length === 0) return;
    await this.db.insert(saleItemDepletions).values(depletions as any);
  }

  async getItemDepletionsBySaleId(
    saleId: number,
  ): Promise<SaleItemDepletion[]> {
    const rows = await this.db
      .select({
        id: saleItemDepletions.id,
        saleId: saleItemDepletions.saleId,
        saleItemId: saleItemDepletions.saleItemId,
        productId: saleItemDepletions.productId,
        batchId: saleItemDepletions.batchId,
        quantityBase: saleItemDepletions.quantityBase,
        costPerUnit: saleItemDepletions.costPerUnit,
        totalCost: saleItemDepletions.totalCost,
        createdAt: saleItemDepletions.createdAt,
        batchNumber: productBatches.batchNumber,
        expiryDate: productBatches.expiryDate,
      })
      .from(saleItemDepletions)
      .leftJoin(
        productBatches,
        eq(saleItemDepletions.batchId, productBatches.id),
      )
      .where(eq(saleItemDepletions.saleId, saleId));
    return rows as unknown as SaleItemDepletion[];
  }

  async getDailySummary(date: string | Date): Promise<{
    revenue: number;
    count: number;
    cash: number;
    card: number;
    transfer: number;
  }> {
    const dateStr =
      typeof date === "string" ? date : date.toISOString().split("T")[0];
    const rows = await this.db
      .select()
      .from(sales)
      .where(
        and(
          sql`${sales.createdAt}::date = ${dateStr}::date`,
          eq(sales.status, "completed"),
        ),
      );

    let revenue = 0;
    let cash = 0;
    let card = 0;
    let transfer = 0;
    for (const row of rows) {
      revenue += row.total;
      if (row.paymentType === "cash") cash += row.total;
      else if (row.paymentType === "credit") card += row.total;
      else transfer += row.total;
    }

    return { revenue, count: rows.length, cash, card, transfer };
  }

  async getTopSelling(limit: number): Promise<
    {
      productId: number;
      productName: string;
      quantity: number;
      revenue: number;
    }[]
  > {
    const rows = await this.db
      .select({
        productId: saleItems.productId,
        productName: saleItems.productName,
        quantity: sql<number>`SUM(${saleItems.quantity})`,
        revenue: sql<number>`SUM(${saleItems.subtotal})`,
      })
      .from(saleItems)
      .groupBy(saleItems.productId, saleItems.productName)
      .orderBy(sql`SUM(${saleItems.quantity}) DESC`)
      .limit(limit);

    return rows.map((r) => ({
      productId: r.productId!,
      productName: r.productName,
      quantity: Number(r.quantity),
      revenue: Number(r.revenue),
    }));
  }

  async generateReceipt(saleId: number): Promise<string> {
    const sale = await this.findById(saleId);
    if (!sale) return "";

    const lines: string[] = [];
    lines.push("=".repeat(40));
    lines.push(`Invoice: ${sale.invoiceNumber}`);
    lines.push(`Date: ${sale.createdAt ?? new Date().toISOString()}`);
    lines.push("-".repeat(40));

    if (sale.items) {
      for (const item of sale.items) {
        lines.push(
          `${item.productName} x${item.quantity} @ ${item.unitPrice} = ${item.subtotal}`,
        );
      }
    }

    lines.push("-".repeat(40));
    lines.push(`Subtotal: ${sale.subtotal}`);
    if (sale.discount) lines.push(`Discount: ${sale.discount}`);
    if (sale.tax) lines.push(`Tax: ${sale.tax}`);
    lines.push(`Total: ${sale.total}`);
    lines.push("=".repeat(40));

    return lines.join("\n");
  }

  // ── Helpers ───────────────────────────────────────────────────

  private async mapSaleWithDetails(row: any): Promise<Sale> {
    const items = await this.db
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, row.id));

    // Fetch depletions for each item and attach
    const itemsWithDepletions = await Promise.all(
      items.map(async (item) => {
        const depletions = await this.db
          .select({
            id: saleItemDepletions.id,
            saleId: saleItemDepletions.saleId,
            saleItemId: saleItemDepletions.saleItemId,
            productId: saleItemDepletions.productId,
            batchId: saleItemDepletions.batchId,
            quantityBase: saleItemDepletions.quantityBase,
            costPerUnit: saleItemDepletions.costPerUnit,
            totalCost: saleItemDepletions.totalCost,
            createdAt: saleItemDepletions.createdAt,
            batchNumber: productBatches.batchNumber,
            expiryDate: productBatches.expiryDate,
          })
          .from(saleItemDepletions)
          .leftJoin(
            productBatches,
            eq(saleItemDepletions.batchId, productBatches.id),
          )
          .where(eq(saleItemDepletions.saleItemId, item.id));

        const cogs = depletions.reduce((sum, d) => sum + d.totalCost, 0);
        const weightedAverageCost =
          depletions.length > 0
            ? Math.round(
                depletions.reduce(
                  (s, d) => s + d.costPerUnit * d.quantityBase,
                  0,
                ) / depletions.reduce((s, d) => s + d.quantityBase, 0),
              )
            : 0;

        return {
          ...item,
          depletions: depletions as unknown as SaleItemDepletion[],
          cogs,
          weightedAverageCost,
        };
      }),
    );

    const totalCogs = itemsWithDepletions.reduce(
      (sum, i) => sum + (i.cogs || 0),
      0,
    );
    const profit = row.total - totalCogs;
    const marginBps =
      row.total > 0 ? Math.round((profit / row.total) * 10000) : 0;

    return {
      ...row,
      items: itemsWithDepletions,
      totalCogs,
      profit,
      marginBps,
    } as Sale;
  }
}
