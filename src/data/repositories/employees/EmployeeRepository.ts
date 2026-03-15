import { and, eq, inArray, like, sql } from "drizzle-orm";
import { Employee, IEmployeeRepository } from "../../../domain/index.js";
import { DbConnection } from "../../db/db.js";
import { employees } from "../../schema/schema.js";

export class EmployeeRepository implements IEmployeeRepository {
  constructor(private db: DbConnection) {}

  async findAll(params?: {
    search?: string;
    department?: string;
    isActive?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Employee[]; total: number }> {
    const conditions: any[] = [];
    if (params?.search) {
      conditions.push(like(employees.name, `%${params.search}%`));
    }
    if (params?.department) {
      conditions.push(eq(employees.department, params.department));
    }
    if (params?.isActive !== undefined) {
      conditions.push(eq(employees.isActive, params.isActive));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalResult = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(employees)
      .where(where);
    const total = Number(totalResult[0]?.count ?? 0);

    let query = this.db.select().from(employees).where(where).$dynamic();
    if (params?.limit) query = query.limit(params.limit);
    if (params?.offset) query = query.offset(params.offset);

    const rows = await query;
    return { items: rows as Employee[], total };
  }

  async findById(id: number): Promise<Employee | null> {
    const [row] = await this.db
      .select()
      .from(employees)
      .where(eq(employees.id, id));
    return (row as Employee) || null;
  }

  async findByIds(ids: number[]): Promise<Employee[]> {
    if (ids.length === 0) return [];
    const rows = await this.db
      .select()
      .from(employees)
      .where(inArray(employees.id, ids));
    return rows as Employee[];
  }

  async create(employee: Employee): Promise<Employee> {
    const [created] = await this.db
      .insert(employees)
      .values(employee as any)
      .returning();
    return created as Employee;
  }

  async update(id: number, employee: Partial<Employee>): Promise<Employee> {
    const [updated] = await this.db
      .update(employees)
      .set({ ...employee, updatedAt: new Date() } as any)
      .where(eq(employees.id, id))
      .returning();
    return updated as Employee;
  }
}
