import { and, eq, like, sql } from "drizzle-orm";
import { Department, IDepartmentRepository } from "../../../domain/index.js";
import { DbConnection } from "../../db/db.js";
import { departments } from "../../schema/schema.js";

export class DepartmentRepository implements IDepartmentRepository {
  constructor(private db: DbConnection) {}

  async findAll(params?: {
    search?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Department[]; total: number }> {
    const conditions: any[] = [];
    if (params?.search) {
      conditions.push(like(departments.name, `%${params.search}%`));
    }
    if (params?.isActive !== undefined) {
      conditions.push(eq(departments.isActive, params.isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(departments)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db.select().from(departments).where(where).$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    return { items: rows as Department[], total };
  }

  async findById(id: number): Promise<Department | null> {
    const [row] = await this.db
      .select()
      .from(departments)
      .where(eq(departments.id, id));
    return (row as Department) || null;
  }

  async create(department: Department): Promise<Department> {
    const [created] = await this.db
      .insert(departments)
      .values(department as any)
      .returning();
    return created as Department;
  }

  async update(
    id: number,
    department: Partial<Department>,
  ): Promise<Department> {
    const [updated] = await this.db
      .update(departments)
      .set({ ...department, updatedAt: new Date() } as any)
      .where(eq(departments.id, id))
      .returning();
    return updated as Department;
  }
}
