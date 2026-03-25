import { eq, like, sql, and } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import { customers } from "../../schema/schema.js";
import { ICustomerRepository, Customer } from "../../../domain/index.js";

export class CustomerRepository implements ICustomerRepository {
  constructor(private db: DbConnection) {}

  // Correlated subquery: always derive totalDebt from the latest ledger entry
  // so that list and detail endpoints share the same source of truth as the
  // customer ledger page.
  //
  // Performance: the idx_cust_ledger_customer index on customer_id ensures the
  // sub-select is an efficient index-range + ORDER BY id DESC LIMIT 1.
  // PostgreSQL's planner typically converts this to a nested loop index join
  // rather than a literal per-row correlated scan.  With typical pagination
  // limits (≤100 rows), this is acceptable without adding a lateral join.
  private get ledgerBalanceExpr() {
    return sql<number>`COALESCE(
      (SELECT cl.balance_after FROM customer_ledger cl
       WHERE cl.customer_id = ${customers.id}
       ORDER BY cl.id DESC LIMIT 1),
      0
    )`;
  }

  async findAll(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Customer[]; total: number }> {
    const conditions: any[] = [];
    if (params?.search) {
      conditions.push(like(customers.name, `%${params.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(customers)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        address: customers.address,
        city: customers.city,
        notes: customers.notes,
        totalPurchases: customers.totalPurchases,
        // Use a distinct alias so the ledger-derived balance never collides
        // with the stale customers.total_debt column.
        ledgerDebt: this.ledgerBalanceExpr,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        createdBy: customers.createdBy,
      })
      .from(customers)
      .where(where)
      .$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    // Explicitly map ledgerDebt → totalDebt so the API never exposes the
    // stale customers.total_debt field.
    const items: Customer[] = rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      city: row.city,
      notes: row.notes,
      totalPurchases: row.totalPurchases ?? 0,
      totalDebt: row.ledgerDebt ?? 0,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
    }));
    return { items, total };
  }

  async findById(id: number): Promise<Customer | null> {
    const [row] = await this.db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        address: customers.address,
        city: customers.city,
        notes: customers.notes,
        totalPurchases: customers.totalPurchases,
        ledgerDebt: this.ledgerBalanceExpr,
        isActive: customers.isActive,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
        createdBy: customers.createdBy,
      })
      .from(customers)
      .where(eq(customers.id, id));
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      phone: row.phone,
      address: row.address,
      city: row.city,
      notes: row.notes,
      totalPurchases: row.totalPurchases ?? 0,
      totalDebt: row.ledgerDebt ?? 0,
      isActive: row.isActive,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      createdBy: row.createdBy,
    } as Customer;
  }

  async create(customer: Customer): Promise<Customer> {
    const [created] = await this.db
      .insert(customers)
      .values(customer as any)
      .returning();
    return created as unknown as Customer;
  }

  async update(id: number, customer: Partial<Customer>): Promise<Customer> {
    const [updated] = await this.db
      .update(customers)
      .set({ ...customer, updatedAt: new Date() } as any)
      .where(eq(customers.id, id))
      .returning();
    return updated as unknown as Customer;
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(customers).where(eq(customers.id, id));
  }

  async updateDebt(id: number, amountChange: number): Promise<void> {
    await this.db
      .update(customers)
      .set({
        totalDebt: sql`${customers.totalDebt} + ${amountChange}`,
        updatedAt: new Date(),
      } as any)
      .where(eq(customers.id, id));
  }
}
