import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
// System Settings — singleton row for general system configuration
// ═══════════════════════════════════════════════════════════════

export const SystemSettingsSchema = z.object({
  id: z.number().optional(),
  companyName: z.string().default(""),
  companyAddress: z.string().nullable().optional(),
  companyPhone: z.string().nullable().optional(),
  companyPhone2: z.string().nullable().optional(),
  companyEmail: z.string().email().nullable().optional(),
  companyTaxId: z.string().nullable().optional(),
  companyLogo: z.string().nullable().optional(),
  defaultCurrency: z.string().min(3).max(3).default("IQD"),
  lowStockThreshold: z.number().int().min(0).default(5),
  accountingEnabled: z.boolean().default(false),
  purchasesEnabled: z.boolean().default(true),
  ledgersEnabled: z.boolean().default(true),
  unitsEnabled: z.boolean().default(false),
  paymentsOnInvoicesEnabled: z.boolean().default(true),
  expiryAlertDays: z.number().int().min(0).default(30),
  debtReminderCount: z.number().int().min(0).default(3),
  debtReminderIntervalDays: z.number().int().min(0).default(7),
  setupWizardCompleted: z.boolean().default(false),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.number().nullable().optional(),
});

export type SystemSettings = z.infer<typeof SystemSettingsSchema>;

/** Partial update input (all fields optional except id) */
export type UpdateSystemSettingsInput = Partial<
  Omit<SystemSettings, "id" | "updatedAt">
>;
