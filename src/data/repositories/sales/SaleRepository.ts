import { eq, and, gte, lte, sql, desc, asc, or, ne } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import type { TxOrDb } from "../../db/transaction.js";
import {
  customers,
  posSettings,
  productBatches,
  saleItemDepletions,
  saleItems,
  sales,
  settings,
  systemSettings,
  users,
} from "../../schema/schema.js";
import {
  ISaleRepository,
  Sale,
  SaleItemDepletion,
  SaleReceipt,
  derivePaymentStatus,
} from "../../../domain/index.js";

export class SaleRepository implements ISaleRepository {
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  async create(sale: Sale, tx?: TxOrDb): Promise<Sale> {
    const { items, ...saleData } = sale;
    const client = this.c(tx);

    const [created] = await client
      .insert(sales)
      .values(saleData as any)
      .returning();

    if (items && items.length > 0) {
      const itemValues = items.map((item) => ({
        ...item,
        saleId: created.id,
      }));
      await client.insert(saleItems).values(itemValues as any);
    }

    return this.mapSaleWithDetails(created, tx);
  }

  async findById(id: number, tx?: TxOrDb): Promise<Sale | null> {
    const client = this.c(tx);
    const [row] = await client.select().from(sales).where(eq(sales.id, id));
    if (!row) return null;
    return this.mapSaleWithDetails(row, tx);
  }

  async findByIdempotencyKey(key: string): Promise<Sale | null> {
    const [row] = await this.db
      .select()
      .from(sales)
      .where(eq(sales.idempotencyKey, key));
    if (!row) return null;
    return this.mapSaleWithDetails(row);
  }

  async findOpenByCustomerId(customerId: number, tx?: TxOrDb): Promise<Sale[]> {
    const client = this.c(tx);
    const rows = await client
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.customerId, customerId),
          ne(sales.status, "cancelled"),
          ne(sales.status, "refunded"),
          sql`${sales.remainingAmount} > 0`,
        ),
      )
      .orderBy(asc(sales.createdAt), asc(sales.id));

    return rows.map((row) => ({
      ...row,
      items: [],
      paymentStatus: derivePaymentStatus(row.paidAmount ?? 0, row.total ?? 0),
    })) as unknown as Sale[];
  }

  async findAll(params?: {
    page: number;
    limit: number;
    customerId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<{ items: Sale[]; total: number }> {
    const conditions: any[] = [];
    if (params?.customerId)
      conditions.push(eq(sales.customerId, params.customerId));
    if (params?.startDate)
      conditions.push(
        gte(sales.createdAt, new Date(params.startDate).toISOString()),
      );
    if (params?.endDate)
      conditions.push(
        lte(sales.createdAt, new Date(params.endDate).toISOString()),
      );

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
    status: "completed" | "cancelled" | "refunded" | "partial_refund",
    tx?: TxOrDb,
  ): Promise<void> {
    await this.c(tx)
      .update(sales)
      .set({ status, updatedAt: new Date() } as any)
      .where(eq(sales.id, id));
  }

  async update(id: number, data: Partial<Sale>, tx?: TxOrDb): Promise<void> {
    const { items, ...saleData } = data;
    await this.c(tx)
      .update(sales)
      .set({ ...saleData, updatedAt: new Date() } as any)
      .where(eq(sales.id, id));
  }

  async createItemDepletions(
    depletions: Omit<
      SaleItemDepletion,
      "id" | "createdAt" | "batchNumber" | "expiryDate"
    >[],
    tx?: TxOrDb,
  ): Promise<void> {
    if (depletions.length === 0) return;
    await this.c(tx)
      .insert(saleItemDepletions)
      .values(depletions as any);
  }

  async incrementItemReturnedQty(
    saleItemId: number,
    addedQtyBase: number,
    tx?: TxOrDb,
  ): Promise<void> {
    await this.c(tx)
      .update(saleItems)
      .set({
        returnedQuantityBase: sql`${saleItems.returnedQuantityBase} + ${addedQtyBase}`,
      } as any)
      .where(eq(saleItems.id, saleItemId));
  }

  async getItemDepletionsBySaleId(
    saleId: number,
    tx?: TxOrDb,
  ): Promise<SaleItemDepletion[]> {
    const rows = await this.c(tx)
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

  async getReceiptData(saleId: number): Promise<SaleReceipt | null> {
    const sale = await this.findById(saleId);
    if (!sale?.id) return null;

    const [system, pos, customer, cashier, legacySettings] = await Promise.all([
      this.db.select().from(systemSettings).limit(1),
      this.db.select().from(posSettings).limit(1),
      sale.customerId
        ? this.db
            .select()
            .from(customers)
            .where(eq(customers.id, sale.customerId))
            .limit(1)
        : Promise.resolve([]),
      sale.createdBy
        ? this.db
            .select()
            .from(users)
            .where(eq(users.id, sale.createdBy))
            .limit(1)
        : Promise.resolve([]),
      this.db.select().from(settings),
    ]);

    const legacyMap = new Map(
      legacySettings.map((row) => [row.key, row.value]),
    );
    const receipt: SaleReceipt = {
      saleId: sale.id,
      invoiceNumber: sale.invoiceNumber,
      createdAt: this.toIsoString(sale.createdAt),
      subtotal: sale.subtotal,
      discount: sale.discount ?? 0,
      tax: sale.tax ?? 0,
      total: sale.total,
      currency: sale.currency || system[0]?.defaultCurrency || "IQD",
      customer: {
        id: customer[0]?.id ?? sale.customerId ?? null,
        name: customer[0]?.name ?? "Walk-in Customer",
        phone: customer[0]?.phone ?? "",
      },
      cashier: {
        id: cashier[0]?.id ?? sale.createdBy ?? null,
        name: cashier[0]?.fullName ?? "",
      },
      branch: {
        id: null,
        name: legacyMap.get("branch_name") || "",
      },
      store: {
        companyName:
          system[0]?.companyName || legacyMap.get("company_name") || "",
        companyNameAr: legacyMap.get("company_name_ar") || "",
        phone: system[0]?.companyPhone || legacyMap.get("company_phone") || "",
        mobile:
          system[0]?.companyPhone2 ||
          legacyMap.get("company_mobile") ||
          legacyMap.get("company_phone2") ||
          "",
        address:
          system[0]?.companyAddress || legacyMap.get("company_address") || "",
        receiptWidth: this.resolveReceiptWidth(
          pos[0]?.paperSize,
          legacyMap.get("receipt_width") || undefined,
        ),
        footerNote:
          pos[0]?.receiptFooter ||
          pos[0]?.invoiceFooterNotes ||
          legacyMap.get("invoice.footerNotes") ||
          legacyMap.get("invoice.footer_notes") ||
          "",
      },
      items: (sale.items ?? []).map((item) => ({
        productId: item.productId ?? null,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        discount: item.discount ?? 0,
        tax: 0,
      })),
    };

    return {
      ...receipt,
      receiptText: this.renderReceiptText(receipt),
    };
  }

  async getMonthlySummary(date: string | Date): Promise<{
    revenue: number;
    count: number;
    cash: number;
    card: number;
    transfer: number;
  }> {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    const month = dateObj.getMonth() + 1;
    const year = dateObj.getFullYear();
    const monthStr = `${year}-${month.toString().padStart(2, "0")}`;

    const rows = await this.db
      .select()
      .from(sales)
      .where(
        and(
          sql`to_char(${sales.createdAt}, 'YYYY-MM') = ${monthStr}`,
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

    return {
      revenue,
      count: rows.length,
      cash,
      card,
      transfer,
    };
  }

  private resolveReceiptWidth(
    paperSize?: string | null,
    explicitWidth?: string,
  ): string {
    if (explicitWidth?.trim()) return explicitWidth.trim();

    switch ((paperSize || "").toLowerCase()) {
      case "a4":
        return "210mm";
      case "a5":
        return "148mm";
      case "thermal":
      default:
        return "80mm";
    }
  }

  private toIsoString(value: string | Date | undefined): string {
    const date = value ? new Date(value) : new Date();
    return Number.isNaN(date.getTime())
      ? new Date().toISOString()
      : date.toISOString();
  }

  private renderReceiptText(receipt: SaleReceipt): string {
    const width = 40;
    const lines: string[] = [];

    const repeat = (char: string, count: number): string => char.repeat(count);

    const center = (text: string, lineWidth = width): string => {
      const value = String(text).trim();
      if (value.length >= lineWidth) return value.slice(0, lineWidth);
      const left = Math.floor((lineWidth - value.length) / 2);
      return " ".repeat(left) + value;
    };

    const leftRight = (
      left: string,
      right: string,
      lineWidth = width,
    ): string => {
      const l = String(left ?? "").trim();
      const r = String(right ?? "").trim();

      if (l.length + r.length + 1 <= lineWidth) {
        return l + " ".repeat(lineWidth - l.length - r.length) + r;
      }

      const maxLeft = Math.max(1, lineWidth - r.length - 1);
      return l.slice(0, maxLeft) + " " + r;
    };

    const wrap = (text: string, lineWidth = width): string[] => {
      const value = String(text ?? "").trim();
      if (!value) return [""];

      const words = value.split(/\s+/);
      const result: string[] = [];
      let current = "";

      for (const word of words) {
        const next = current ? `${current} ${word}` : word;
        if (next.length <= lineWidth) {
          current = next;
        } else {
          if (current) result.push(current);

          if (word.length > lineWidth) {
            for (let i = 0; i < word.length; i += lineWidth) {
              result.push(word.slice(i, i + lineWidth));
            }
            current = "";
          } else {
            current = word;
          }
        }
      }

      if (current) result.push(current);
      return result;
    };

    const money = (value: unknown): string => {
      const num = Number(value ?? 0);
      return Number.isFinite(num) ? num.toLocaleString("en-US") : "0";
    };

    const formatDate = (value: unknown): string => {
      const date = value ? new Date(String(value)) : new Date();
      if (Number.isNaN(date.getTime())) return String(value ?? "");
      return date.toLocaleString("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    };

    lines.push(center(receipt.store.companyName || "STORE RECEIPT"));
    if (receipt.store.companyNameAr) {
      lines.push(center(receipt.store.companyNameAr));
    }
    lines.push(repeat("=", width));
    lines.push(leftRight("Invoice", receipt.invoiceNumber || "-"));
    lines.push(leftRight("Date", formatDate(receipt.createdAt)));
    lines.push(repeat("-", width));

    for (const item of receipt.items) {
      const nameLines = wrap(String(item.productName ?? "Item"), width);
      lines.push(...nameLines);

      lines.push(
        leftRight(
          `${money(item.unitPrice)} x ${item.quantity}`,
          money(item.subtotal),
        ),
      );

      if (Number(item.discount ?? 0) > 0) {
        lines.push(leftRight("Discount", money(item.discount)));
      }

      lines.push(repeat("-", width));
    }

    lines.push(leftRight("Subtotal", money(receipt.subtotal)));

    if (Number(receipt.discount ?? 0) > 0) {
      lines.push(leftRight("Discount", money(receipt.discount)));
    }

    if (Number(receipt.tax ?? 0) > 0) {
      lines.push(leftRight("Tax", money(receipt.tax)));
    }

    lines.push(leftRight("Total", money(receipt.total)));
    if (receipt.cashier.name) {
      lines.push(leftRight("Cashier", receipt.cashier.name));
    }
    if (receipt.customer.name) {
      lines.push(leftRight("Customer", receipt.customer.name));
    }
    lines.push(repeat("=", width));
    lines.push(center(receipt.store.footerNote || "Thank you"));

    return lines.join("\n");
  }

  // ── Helpers ───────────────────────────────────────────────────

  private async mapSaleWithDetails(row: any, tx?: TxOrDb): Promise<Sale> {
    const client = this.c(tx);
    const items = await client
      .select()
      .from(saleItems)
      .where(eq(saleItems.saleId, row.id));

    // Fetch depletions for each item and attach
    const itemsWithDepletions = await Promise.all(
      items.map(async (item) => {
        const depletions = await client
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
          .where(eq(saleItemDepletions.saleItemId, item.id as number));

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
      paymentStatus: derivePaymentStatus(row.paidAmount ?? 0, row.total ?? 0),
      totalCogs,
      profit,
      marginBps,
    } as Sale;
  }
}
