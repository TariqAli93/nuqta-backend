import { ISettingsRepository } from "../interfaces/ISettingsRepository.js";
import {
  MODULE_SETTING_KEYS,
  NOTIFICATION_SETTING_KEYS,
  INVOICE_SETTING_KEYS,
  SETUP_SETTING_KEYS,
  type ModuleSettings,
  type NotificationSettings,
  type InvoiceSettings,
} from "../entities/ModuleSettings.js";

/**
 * GetModuleSettingsUseCase
 * Reads all module toggle, notification, and invoice settings from the KV store
 * and returns them as typed objects.
 */
export class GetModuleSettingsUseCase {
  constructor(private settingsRepo: ISettingsRepository) {}

  async execute(): Promise<{
    modules: ModuleSettings;
    notifications: NotificationSettings;
    invoice: InvoiceSettings;
    wizardCompleted: boolean;
  }> {
    const pick = async (keys: string[]): Promise<string | null> => {
      for (const key of keys) {
        const value = await this.settingsRepo.get(key);
        if (value !== null) return value;
      }
      return null;
    };

    const toBool = async (
      keys: string[],
      fallback: boolean,
    ): Promise<boolean> => {
      const v = await pick(keys);
      if (v === null) return fallback;
      return v === "true";
    };

    const toInt = async (keys: string[], fallback: number): Promise<number> => {
      const v = await pick(keys);
      if (v === null) return fallback;
      const n = parseInt(v, 10);
      return isNaN(n) ? fallback : n;
    };

    const toStr = async (keys: string[], fallback: string): Promise<string> => {
      const v = await pick(keys);
      return v ?? fallback;
    };

    const modules: ModuleSettings = {
      accountingEnabled: await toBool(
        [MODULE_SETTING_KEYS.ACCOUNTING_ENABLED, "modules.accounting.enabled"],
        false,
      ),
      purchasesEnabled: await toBool(
        [MODULE_SETTING_KEYS.PURCHASES_ENABLED, "modules.purchases.enabled"],
        true,
      ),
      ledgersEnabled: await toBool(
        [MODULE_SETTING_KEYS.LEDGERS_ENABLED, "modules.ledgers.enabled"],
        true,
      ),
      unitsEnabled: await toBool(
        [MODULE_SETTING_KEYS.UNITS_ENABLED, "modules.units.enabled"],
        false,
      ),
      paymentsOnInvoicesEnabled: await toBool(
        [
          MODULE_SETTING_KEYS.PAYMENTS_ON_INVOICES_ENABLED,
          "modules.payments_on_invoices.enabled",
        ],
        true,
      ),
    };

    const notifications: NotificationSettings = {
      lowStockThreshold: await toInt(
        [
          NOTIFICATION_SETTING_KEYS.LOW_STOCK_THRESHOLD,
          "notifications.low_stock_threshold",
        ],
        5,
      ),
      expiryDays: await toInt(
        [NOTIFICATION_SETTING_KEYS.EXPIRY_DAYS, "notifications.expiry_days"],
        30,
      ),
      debtReminderCount: await toInt(
        [NOTIFICATION_SETTING_KEYS.DEBT_REMINDER_COUNT],
        3,
      ),
      debtReminderIntervalDays: await toInt(
        [
          NOTIFICATION_SETTING_KEYS.DEBT_REMINDER_INTERVAL_DAYS,
          "notifications.debt_reminder_interval",
        ],
        7,
      ),
    };

    const invoice: InvoiceSettings = {
      templateActiveId: await toStr(
        [INVOICE_SETTING_KEYS.TEMPLATE_ACTIVE_ID],
        "default",
      ),
      prefix: await toStr(
        [INVOICE_SETTING_KEYS.PREFIX, "invoice.prefix"],
        "INV",
      ),
      paperSize: (await toStr(
        [INVOICE_SETTING_KEYS.PAPER_SIZE, "invoice.paper_size"],
        "thermal",
      )) as "thermal" | "a4" | "a5",
      logo: await toStr([INVOICE_SETTING_KEYS.LOGO], ""),
      footerNotes: await toStr(
        [INVOICE_SETTING_KEYS.FOOTER_NOTES, "invoice.footer_notes"],
        "",
      ),
      layoutDirection: (await toStr(
        [INVOICE_SETTING_KEYS.LAYOUT_DIRECTION],
        "rtl",
      )) as "rtl" | "ltr",
      showQr: await toBool(
        [INVOICE_SETTING_KEYS.SHOW_QR, "invoice.show_qr"],
        false,
      ),
      showBarcode: await toBool([INVOICE_SETTING_KEYS.SHOW_BARCODE], false),
    };

    const wizardCompleted = await toBool(
      [SETUP_SETTING_KEYS.WIZARD_COMPLETED, "setup.wizard_completed"],
      false,
    );

    return { modules, notifications, invoice, wizardCompleted };
  }
}
