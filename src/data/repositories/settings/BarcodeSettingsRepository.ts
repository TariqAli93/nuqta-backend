import { eq } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import { barcodeSettings } from "../../schema/schema.js";
import type {
  IBarcodeSettingsRepository,
  BarcodeSettingsEntity,
  UpdateBarcodeSettingsInput,
} from "../../../domain/index.js";

export class BarcodeSettingsRepository implements IBarcodeSettingsRepository {
  constructor(private db: DbConnection) {}

  async get(): Promise<BarcodeSettingsEntity> {
    const [row] = await this.db.select().from(barcodeSettings).limit(1);
    if (row) return row as unknown as BarcodeSettingsEntity;

    // Auto-create default singleton row
    const [created] = await this.db
      .insert(barcodeSettings)
      .values({ defaultBarcodeType: "CODE128" })
      .returning();
    return created as unknown as BarcodeSettingsEntity;
  }

  async update(
    input: UpdateBarcodeSettingsInput,
  ): Promise<BarcodeSettingsEntity> {
    const current = await this.get();

    const [updated] = await this.db
      .update(barcodeSettings)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(barcodeSettings.id, current.id!))
      .returning();

    return updated as unknown as BarcodeSettingsEntity;
  }
}
