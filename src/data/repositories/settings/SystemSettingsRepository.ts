import { eq } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import { systemSettings } from "../../schema/schema.js";
import type {
  ISystemSettingsRepository,
  SystemSettings,
  UpdateSystemSettingsInput,
} from "../../../domain/index.js";

export class SystemSettingsRepository implements ISystemSettingsRepository {
  constructor(private db: DbConnection) {}

  async get(): Promise<SystemSettings> {
    const [row] = await this.db.select().from(systemSettings).limit(1);
    if (row) return row as unknown as SystemSettings;

    // Auto-create default singleton row
    const [created] = await this.db
      .insert(systemSettings)
      .values({ companyName: "" })
      .returning();
    return created as unknown as SystemSettings;
  }

  async update(input: UpdateSystemSettingsInput): Promise<SystemSettings> {
    const current = await this.get();

    const [updated] = await this.db
      .update(systemSettings)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(systemSettings.id, current.id!))
      .returning();

    return updated as unknown as SystemSettings;
  }
}
