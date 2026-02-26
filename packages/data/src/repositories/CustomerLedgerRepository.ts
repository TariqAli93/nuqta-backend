import { eq, and, gte, lte, sql, desc } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { customerLedger } from "../schema/schema.js";
import { ICustomerLedgerRepository, CustomerLedgerEntry } from "@nuqta/core";

export class CustomerLedgerRepository implements ICustomerLedgerRepository {
  constructor(private db: DbConnection) {}

  async create(
    entry: Omit<CustomerLedgerEntry, "id" | "createdAt">,
  ): Promise<CustomerLedgerEntry> {
    const [created] = await this.db
      .insert(customerLedger)
      .values(entry as any)
      .returning();
    return created as unknown as CustomerLedgerEntry;
  }

  async createSync(
    entry: Omit<CustomerLedgerEntry, "id" | "createdAt">,
  ): Promise<CustomerLedgerEntry> {
    return this.create(entry);
  }

  async getLastBalanceSync(customerId: number): Promise<number> {
    const [row] = await this.db
      .select({ balanceAfter: customerLedger.balanceAfter })
      .from(customerLedger)
      .where(eq(customerLedger.customerId, customerId))
      .orderBy(desc(customerLedger.id))
      .limit(1);
    return row?.balanceAfter ?? 0;
  }

  async findByPaymentIdSync(
    paymentId: number,
  ): Promise<CustomerLedgerEntry | null> {
    const [row] = await this.db
      .select()
      .from(customerLedger)
      .where(eq(customerLedger.paymentId, paymentId));
    return (row as unknown as CustomerLedgerEntry) || null;
  }

  async findAll(params: {
    customerId: number;
    dateFrom?: string;
    dateTo?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: CustomerLedgerEntry[]; total: number }> {
    const conditions: any[] = [
      eq(customerLedger.customerId, params.customerId),
    ];
    if (params.dateFrom)
      conditions.push(gte(customerLedger.createdAt, new Date(params.dateFrom)));
    if (params.dateTo)
      conditions.push(lte(customerLedger.createdAt, new Date(params.dateTo)));

    const where = and(...conditions);

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(customerLedger)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db
      .select()
      .from(customerLedger)
      .where(where)
      .orderBy(desc(customerLedger.id))
      .$dynamic();
    if (params.limit) query = query.limit(params.limit);
    if (params.offset) query = query.offset(params.offset);

    const rows = await query;
    return { items: rows as unknown as CustomerLedgerEntry[], total };
  }

  async getBalance(customerId: number): Promise<number> {
    return this.getLastBalanceSync(customerId);
  }
}
