import { eq, sql } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { users } from "../schema/schema.js";
import { IUserRepository, User } from "@nuqta/core";

export class UserRepository implements IUserRepository {
  constructor(private db: DbConnection) {}

  async findByUsername(username: string): Promise<User | null> {
    const [item] = await this.db
      .select()
      .from(users)
      .where(eq(users.username, username));
    return (item as unknown as User) || null;
  }

  async findById(id: number): Promise<User | null> {
    const [item] = await this.db.select().from(users).where(eq(users.id, id));
    return (item as unknown as User) || null;
  }

  async create(user: User): Promise<User> {
    const [created] = await this.db
      .insert(users)
      .values(user as any)
      .returning();
    return created as unknown as User;
  }

  async findAll(): Promise<User[]> {
    const results = await this.db.select().from(users);
    return results as unknown as User[];
  }

  async update(id: number, data: Partial<User>): Promise<User> {
    const [updated] = await this.db
      .update(users)
      .set({ ...data, updatedAt: new Date() } as any)
      .where(eq(users.id, id))
      .returning();
    return updated as unknown as User;
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    return Number(result?.count ?? 0);
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date() } as any)
      .where(eq(users.id, id));
  }
}
