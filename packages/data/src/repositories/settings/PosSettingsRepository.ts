import { eq } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import { posSettings } from "../../schema/schema.js";
import type {
  IPosSettingsRepository,
  PosSettingsEntity,
  UpdatePosSettingsInput,
} from "@nuqta/core";

export class PosSettingsRepository implements IPosSettingsRepository {
  constructor(private db: DbConnection) {}

  async get(): Promise<PosSettingsEntity> {
    const [row] = await this.db.select().from(posSettings).limit(1);
    if (row) return row as unknown as PosSettingsEntity;

    // Auto-create default singleton row
    const [created] = await this.db
      .insert(posSettings)
      .values({ invoicePrefix: "INV" })
      .returning();
    return created as unknown as PosSettingsEntity;
  }

  async update(input: UpdatePosSettingsInput): Promise<PosSettingsEntity> {
    const current = await this.get();

    const [updated] = await this.db
      .update(posSettings)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(posSettings.id, current.id!))
      .returning();

    return updated as unknown as PosSettingsEntity;
  }
}
