import { eq } from "drizzle-orm";
import { DbConnection } from "../db.js";
import { settings, currencySettings } from "../schema/schema.js";
import type { ISettingsRepository, CompanySettings } from "@nuqta/core";

export class SettingsRepository implements ISettingsRepository {
  constructor(private db: DbConnection) {}

  async getCurrencySettings(): Promise<{
    defaultCurrency: string;
    usdRate: number;
    iqdRate: number;
  }> {
    const rows = await this.db.select().from(currencySettings);
    const iqdRow = rows.find((r) => r.currencyCode === "IQD");
    const usdRow = rows.find((r) => r.currencyCode === "USD");
    return {
      defaultCurrency: iqdRow ? "IQD" : "USD",
      usdRate: usdRow?.exchangeRate ?? 1480,
      iqdRate: iqdRow?.exchangeRate ?? 1,
    };
  }

  async get(key: string): Promise<string | null> {
    const [row] = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key));
    return row?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    const [existing] = await this.db
      .select()
      .from(settings)
      .where(eq(settings.key, key));

    if (existing) {
      await this.db
        .update(settings)
        .set({ value, updatedAt: new Date() } as any)
        .where(eq(settings.key, key));
    } else {
      await this.db.insert(settings).values({ key, value } as any);
    }
  }

  async getCompanySettings(): Promise<CompanySettings | null> {
    const keys = [
      "company_name",
      "company_address",
      "company_phone",
      "company_phone2",
      "company_email",
      "company_tax_id",
      "company_logo",
      "default_currency",
      "low_stock_threshold",
    ];

    const rows = await this.db.select().from(settings);
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const name = map.get("company_name");
    if (!name) return null;

    return {
      name,
      address: map.get("company_address") ?? null,
      phone: map.get("company_phone") ?? null,
      phone2: map.get("company_phone2") ?? null,
      email: map.get("company_email") ?? null,
      taxId: map.get("company_tax_id") ?? null,
      logo: map.get("company_logo") ?? null,
      currency: map.get("default_currency") ?? "IQD",
      lowStockThreshold: parseInt(map.get("low_stock_threshold") ?? "5", 10),
    };
  }

  async setCompanySettings(cs: CompanySettings): Promise<void> {
    const pairs: [string, string][] = [
      ["company_name", cs.name],
      ["company_address", cs.address ?? ""],
      ["company_phone", cs.phone ?? ""],
      ["company_phone2", cs.phone2 ?? ""],
      ["company_email", cs.email ?? ""],
      ["company_tax_id", cs.taxId ?? ""],
      ["company_logo", cs.logo ?? ""],
      ["default_currency", cs.currency],
      ["low_stock_threshold", String(cs.lowStockThreshold)],
    ];
    for (const [key, value] of pairs) {
      await this.set(key, value);
    }
  }
}
