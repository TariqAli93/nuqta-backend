import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
// Accounting Settings — singleton row for accounting configuration
// ═══════════════════════════════════════════════════════════════

export const COST_METHODS = ["fifo", "weighted_average", "lifo"] as const;
export const ROUNDING_METHODS = ["round", "floor", "ceil"] as const;

export const AccountingSettingsSchema = z.object({
  id: z.number().optional(),
  taxEnabled: z.boolean().default(false),
  defaultTaxRate: z.number().min(0).max(100).default(0),
  taxRegistrationNumber: z.string().nullable().optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).default(1),
  fiscalYearStartDay: z.number().int().min(1).max(31).default(1),
  autoPosting: z.boolean().default(false),
  costMethod: z.enum(COST_METHODS).default("fifo"),
  currencyCode: z.string().min(3).max(3).default("IQD"),
  usdExchangeRate: z.number().min(0).default(1480),
  roundingMethod: z.enum(ROUNDING_METHODS).default("round"),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.number().nullable().optional(),
});

export type AccountingSettingsEntity = z.infer<typeof AccountingSettingsSchema>;

/** Partial update input */
export type UpdateAccountingSettingsInput = Partial<
  Omit<AccountingSettingsEntity, "id" | "updatedAt">
>;
