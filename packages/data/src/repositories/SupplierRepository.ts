import { eq, like, sql, and } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { suppliers } from "../schema/schema.js";
import { ISupplierRepository, Supplier } from "@nuqta/core";

export class SupplierRepository implements ISupplierRepository {
  constructor(private db: DbConnection) {}

  async findAll(params?: {
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Supplier[]; total: number }> {
    const conditions: any[] = [];
    if (params?.search) {
      conditions.push(like(suppliers.name, `%${params.search}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(suppliers)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db.select().from(suppliers).where(where).$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const items = await query;
    return { items: items as unknown as Supplier[], total };
  }

  async findByIdSync(id: number): Promise<Supplier | null> {
    return this.findById(id);
  }

  async findById(id: number): Promise<Supplier | null> {
    const [item] = await this.db
      .select()
      .from(suppliers)
      .where(eq(suppliers.id, id));
    return (item as unknown as Supplier) || null;
  }

  async create(
    supplier: Omit<Supplier, "id" | "createdAt" | "updatedAt">,
  ): Promise<Supplier> {
    const [created] = await this.db
      .insert(suppliers)
      .values(supplier as any)
      .returning();
    return created as unknown as Supplier;
  }

  async update(id: number, supplier: Partial<Supplier>): Promise<Supplier> {
    const [updated] = await this.db
      .update(suppliers)
      .set({ ...supplier, updatedAt: new Date() } as any)
      .where(eq(suppliers.id, id))
      .returning();
    return updated as unknown as Supplier;
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(suppliers).where(eq(suppliers.id, id));
  }

  async updatePayable(id: number, amountChange: number): Promise<void> {
    await this.db
      .update(suppliers)
      .set({
        currentBalance: sql`${suppliers.currentBalance} + ${amountChange}`,
        updatedAt: new Date(),
      } as any)
      .where(eq(suppliers.id, id));
  }
}
