// ═══════════════════════════════════════════════════════════════
// Settings Accessor — Typed, domain-grouped settings access
// Wraps the flat KV settings store with typed getters
// ═══════════════════════════════════════════════════════════════

import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";

export class SettingsAccessor {
  constructor(private repo: ISettingsRepository) {}

  // ── System ──────────────────────────────────────────────────
  async getLanguage(): Promise<string> {
    return (await this.repo.get("system.language")) || "ar";
  }

  async getTimezone(): Promise<string> {
    return (await this.repo.get("system.timezone")) || "Asia/Baghdad";
  }

  async getBackupPath(): Promise<string | null> {
    return await this.repo.get("system.backupPath");
  }

  // ── POS ─────────────────────────────────────────────────────
  async getDefaultPaymentMethod(): Promise<string> {
    return (await this.repo.get("pos.defaultPaymentMethod")) || "cash";
  }

  async isPrinterEnabled(): Promise<boolean> {
    return (await this.repo.get("pos.printerEnabled")) !== "false";
  }

  async isAutoGenerateInvoice(): Promise<boolean> {
    return (await this.repo.get("pos.autoGenerateInvoice")) !== "false";
  }

  // ── Accounting ──────────────────────────────────────────────
  async isAccountingEnabled(): Promise<boolean> {
    const value =
      (await this.repo.get("accounting.enabled")) ??
      (await this.repo.get("modules.accounting.enabled"));
    return value !== "false";
  }

  async isLedgersEnabled(): Promise<boolean> {
    const value =
      (await this.repo.get("ledgers.enabled")) ??
      (await this.repo.get("modules.ledgers.enabled"));
    return value !== "false";
  }

  async isUnitsEnabled(): Promise<boolean> {
    const value =
      (await this.repo.get("units.enabled")) ??
      (await this.repo.get("modules.units.enabled"));
    return value !== "false";
  }

  async getFiscalYearStart(): Promise<string> {
    return (await this.repo.get("accounting.fiscalYearStart")) || "01-01";
  }

  async getBaseCurrency(): Promise<string> {
    return (await this.repo.get("currency.base")) || "IQD";
  }

  // ── Barcode ─────────────────────────────────────────────────
  async getDefaultTemplateId(): Promise<number | null> {
    const value = await this.repo.get("barcode.defaultTemplateId");
    return value ? parseInt(value, 10) : null;
  }

  async getBarcodePrinterType(): Promise<string> {
    return (await this.repo.get("barcode.printerType")) || "thermal";
  }

  async getBarcodeDpi(): Promise<number> {
    const value = await this.repo.get("barcode.dpi");
    return value ? parseInt(value, 10) : 203;
  }

  // ── Notifications ───────────────────────────────────────────
  async isLowStockNotificationEnabled(): Promise<boolean> {
    const value =
      (await this.repo.get("notifications.lowStock")) ??
      (await this.repo.get("modules.notifications.lowStock"));
    return value !== "false";
  }

  async isExpiryAlertEnabled(): Promise<boolean> {
    const value =
      (await this.repo.get("notifications.expiryAlerts")) ??
      (await this.repo.get("modules.notifications.expiryAlerts"));
    return value !== "false";
  }

  // ── Invoice ─────────────────────────────────────────────────
  async isShowLogoOnInvoice(): Promise<boolean> {
    const value =
      (await this.repo.get("invoice.showLogo")) ??
      (await this.repo.get("modules.invoice.showLogo"));
    return value !== "false";
  }

  async getInvoiceFooterText(): Promise<string> {
    return (
      (await this.repo.get("invoice.footerText")) ??
      (await this.repo.get("modules.invoice.footerText")) ??
      "شكراً لتسوقكم"
    );
  }

  // ── Accounting Account Codes ───────────────────────────────
  async getCashAccountCode(): Promise<string> {
    return (await this.repo.get("accounting.cashAccountCode")) || "1001";
  }

  async getArAccountCode(): Promise<string> {
    return (await this.repo.get("accounting.arAccountCode")) || "1100";
  }

  async getApAccountCode(): Promise<string> {
    return (await this.repo.get("accounting.apAccountCode")) || "2100";
  }

  async getInventoryAccountCode(): Promise<string> {
    return (await this.repo.get("accounting.inventoryAccountCode")) || "1200";
  }

  async getSalesRevenueAccountCode(): Promise<string> {
    return (await this.repo.get("accounting.salesRevenueAccountCode")) || "4001";
  }

  async getCogsAccountCode(): Promise<string> {
    return (await this.repo.get("accounting.cogsAccountCode")) || "5001";
  }

  async getVatInputAccountCode(): Promise<string> {
    return (await this.repo.get("accounting.vatInputAccountCode")) || "1300";
  }

  async getVatOutputAccountCode(): Promise<string> {
    return (await this.repo.get("accounting.vatOutputAccountCode")) || "2200";
  }

  // ── Generic getter for custom keys ──────────────────────────
  async get(key: string): Promise<string | null> {
    return await this.repo.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await this.repo.set(key, value);
  }
}
