import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Module Settings — typed keys for setup wizard toggles
// ═══════════════════════════════════════════════════════════════

/** All module toggle keys with their expected types */
export const MODULE_SETTING_KEYS = {
  ACCOUNTING_ENABLED: 'accounting.enabled',
  PURCHASES_ENABLED: 'purchases.enabled',
  LEDGERS_ENABLED: 'ledgers.enabled',
  UNITS_ENABLED: 'units.enabled',
  PAYMENTS_ON_INVOICES_ENABLED: 'paymentsOnInvoices.enabled',
} as const;

export const NOTIFICATION_SETTING_KEYS = {
  LOW_STOCK_THRESHOLD: 'notifications.lowStockThreshold',
  EXPIRY_DAYS: 'notifications.expiryDays',
  DEBT_REMINDER_COUNT: 'notifications.debtReminderCount',
  DEBT_REMINDER_INTERVAL_DAYS: 'notifications.debtReminderIntervalDays',
} as const;

export const INVOICE_SETTING_KEYS = {
  TEMPLATE_ACTIVE_ID: 'invoice.template.activeId',
  PREFIX: 'invoice.series.prefix',
  PAPER_SIZE: 'invoice.paperSize',
  LOGO: 'invoice.logo',
  FOOTER_NOTES: 'invoice.footerNotes',
  LAYOUT_DIRECTION: 'invoice.layoutDirection',
  SHOW_QR: 'invoice.showQr',
  SHOW_BARCODE: 'invoice.showBarcode',
} as const;

export const SETUP_SETTING_KEYS = {
  WIZARD_COMPLETED: 'setup.wizardCompleted',
} as const;

/** Aggregate view of all module settings for the UI */
export const ModuleSettingsSchema = z.object({
  accountingEnabled: z.boolean().default(false),
  purchasesEnabled: z.boolean().default(true),
  ledgersEnabled: z.boolean().default(true),
  unitsEnabled: z.boolean().default(false),
  paymentsOnInvoicesEnabled: z.boolean().default(true),
});

export const NotificationSettingsSchema = z.object({
  lowStockThreshold: z.number().int().min(0).default(5),
  expiryDays: z.number().int().min(0).default(30),
  debtReminderCount: z.number().int().min(0).default(3),
  debtReminderIntervalDays: z.number().int().min(0).default(7),
});

export const InvoiceSettingsSchema = z.object({
  templateActiveId: z.string().default('default'),
  prefix: z.string().default('INV'),
  paperSize: z.enum(['thermal', 'a4', 'a5']).default('thermal'),
  logo: z.string().default(''),
  footerNotes: z.string().default(''),
  layoutDirection: z.enum(['rtl', 'ltr']).default('rtl'),
  showQr: z.boolean().default(false),
  showBarcode: z.boolean().default(false),
});

export type ModuleSettings = z.infer<typeof ModuleSettingsSchema>;
export type NotificationSettings = z.infer<typeof NotificationSettingsSchema>;
export type InvoiceSettings = z.infer<typeof InvoiceSettingsSchema>;

/** Combined wizard settings for the setup wizard completion */
export interface SetupWizardSettings {
  modules: ModuleSettings;
  notifications: NotificationSettings;
  invoice: InvoiceSettings;
}
