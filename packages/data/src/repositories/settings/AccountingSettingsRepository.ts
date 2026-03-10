import { eq } from "drizzle-orm";
import { DbConnection } from "../../db/db.js";
import { accountingSettings } from "../../schema/schema.js";
import type {
  IAccountingSettingsRepository,
  AccountingSettingsEntity,
  UpdateAccountingSettingsInput,
} from "@nuqta/core";

export class AccountingSettingsRepository implements IAccountingSettingsRepository {
  constructor(private db: DbConnection) {}

  async get(): Promise<AccountingSettingsEntity> {
    const [row] = await this.db.select().from(accountingSettings).limit(1);
    if (row) return row as unknown as AccountingSettingsEntity;

    // Auto-create default singleton row
    const [created] = await this.db
      .insert(accountingSettings)
      .values({ taxEnabled: false })
      .returning();
    return created as unknown as AccountingSettingsEntity;
  }

  async update(
    input: UpdateAccountingSettingsInput,
  ): Promise<AccountingSettingsEntity> {
    const current = await this.get();

    const [updated] = await this.db
      .update(accountingSettings)
      .set({
        ...input,
        updatedAt: new Date().toISOString(),
      } as any)
      .where(eq(accountingSettings.id, current.id!))
      .returning();

    return updated as unknown as AccountingSettingsEntity;
  }
}
