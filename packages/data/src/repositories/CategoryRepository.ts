import { eq } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { categories } from "../schema/schema.js";
import { ICategoryRepository, Category } from "@nuqta/core";

export class CategoryRepository implements ICategoryRepository {
  constructor(private db: DbConnection) {}

  async findAll(): Promise<Category[]> {
    const results = await this.db.select().from(categories);
    return results as unknown as Category[];
  }

  async findById(id: number): Promise<Category | null> {
    const [item] = await this.db
      .select()
      .from(categories)
      .where(eq(categories.id, id));
    return (item as unknown as Category) || null;
  }

  async create(category: Category): Promise<Category> {
    const [created] = await this.db
      .insert(categories)
      .values(category as any)
      .returning();
    return created as unknown as Category;
  }

  async update(id: number, category: Partial<Category>): Promise<Category> {
    const [updated] = await this.db
      .update(categories)
      .set(category as any)
      .where(eq(categories.id, id))
      .returning();
    return updated as unknown as Category;
  }

  async delete(id: number): Promise<void> {
    await this.db.delete(categories).where(eq(categories.id, id));
  }
}
