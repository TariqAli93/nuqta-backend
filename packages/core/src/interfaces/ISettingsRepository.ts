import type { CompanySettings } from "../entities/Settings.js";

export interface ISettingsRepository {
  getCurrencySettings(): Promise<{
    defaultCurrency: string;
    usdRate: number;
    iqdRate: number;
  }>;
  get(key: string): Promise<string | null>;
  getAll(): Promise<Record<string, string>>;
  set(key: string, value: string): Promise<void>;
  getCompanySettings(): Promise<CompanySettings | null>;
  setCompanySettings(settings: CompanySettings): Promise<void>;
}
