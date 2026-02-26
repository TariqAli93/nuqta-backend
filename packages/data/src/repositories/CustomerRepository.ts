import { eq, like, sql, and } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { customers } from "../schema/schema.js";
import { ICustomerRepository, Customer } from "@nuqta/core";

export class CustomerRepository implements ICustomerRepository {
  constructor(private db: DbConnection) {}

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

    let query = this.db.select().from(customers).where(where).$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const items = await query;
    return { items: items as unknown as Customer[], total };
  }

  async findById(id: number): Promise<Customer | null> {
    const [item] = await this.db
      .select()
      .from(customers)
      .where(eq(customers.id, id));
    return (item as unknown as Customer) || null;
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
