import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import type { TxOrDb } from "../../db/transaction.js";
import { supplierLedger } from "../../schema/schema.js";
import { ISupplierLedgerRepository, SupplierLedgerEntry } from "../../../domain/index.js";

export class SupplierLedgerRepository implements ISupplierLedgerRepository {
  constructor(private db: DbConnection) {}

  private c(tx?: TxOrDb): TxOrDb {
    return tx ?? this.db;
  }

  async create(
    entry: Omit<SupplierLedgerEntry, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<SupplierLedgerEntry> {
    const [created] = await this.c(tx)
      .insert(supplierLedger)
      .values(entry as any)
      .returning();
    return created as unknown as SupplierLedgerEntry;
  }

  async createSync(
    entry: Omit<SupplierLedgerEntry, "id" | "createdAt">,
    tx?: TxOrDb,
  ): Promise<SupplierLedgerEntry> {
    return this.create(entry, tx);
  }

  async getLastBalanceSync(supplierId: number, tx?: TxOrDb): Promise<number> {
    const [row] = await this.c(tx)
      .select({ balanceAfter: supplierLedger.balanceAfter })
      .from(supplierLedger)
      .where(eq(supplierLedger.supplierId, supplierId))
      .orderBy(desc(supplierLedger.id))
      .limit(1);
    return row?.balanceAfter ?? 0;
  }

  async findByPaymentIdSync(
    paymentId: number,
  ): Promise<SupplierLedgerEntry | null> {
    const [row] = await this.db
      .select()
      .from(supplierLedger)
      .where(eq(supplierLedger.paymentId, paymentId));
    return (row as unknown as SupplierLedgerEntry) || null;
  }

  async findAll(params: {
    supplierId: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: SupplierLedgerEntry[]; total: number }> {
    const conditions: any[] = [
      eq(supplierLedger.supplierId, params.supplierId),
    ];
    if (params.dateFrom)
      conditions.push(
        gte(supplierLedger.createdAt, new Date(params.dateFrom).toISOString()),
      );
    if (params.dateTo)
      conditions.push(
        lte(supplierLedger.createdAt, new Date(params.dateTo).toISOString()),
      );

    const where = and(...conditions);

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(supplierLedger)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db
      .select()
      .from(supplierLedger)
      .where(where)
      .orderBy(desc(supplierLedger.id))
      .$dynamic();
    if (params.limit) query = query.limit(params.limit);
    if (params.offset) query = query.offset(params.offset);

    const rows = await query;
    return { items: rows as unknown as SupplierLedgerEntry[], total };
  }

  async getBalance(supplierId: number): Promise<number> {
    return this.getLastBalanceSync(supplierId);
  }
}
