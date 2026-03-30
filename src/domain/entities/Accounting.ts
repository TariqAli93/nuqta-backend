import { z } from "zod";

export const AccountSchema = z.object({
  id: z.number().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().nullable().optional(),
  accountType: z.enum(["asset", "liability", "equity", "revenue", "expense"]),
  parentId: z.number().nullable().optional(),
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
  balance: z.number().int().default(0),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const JournalLineSchema = z.object({
  id: z.number().optional(),
  journalEntryId: z.number().optional(),
  accountId: z.number().min(1),
  /**
   * Customer or supplier ID — must be set on AR/AP lines so the reconciliation
   * engine can match debit lines (invoices) with credit lines (payments) for the
   * same partner.
   */
  partnerId: z.number().nullable().optional(),
  debit: z.number().int().default(0),
  credit: z.number().int().default(0),
  /** Net balance of this line (debit - credit). Positive = debit side. */
  balance: z.number().int().default(0),
  description: z.string().nullable().optional(),
  /** True once this line has been fully applied in a reconciliation. */
  reconciled: z.boolean().default(false),
  /** FK to reconciliations.id. Set when line is reconciled. */
  reconciliationId: z.number().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const JournalEntrySchema = z.object({
  id: z.number().optional(),
  entryNumber: z.string().min(1),
  entryDate: z.union([z.string(), z.date()]),
  description: z.string().min(1),
  sourceType: z
    .enum([
      "sale",
      "purchase",
      "payment",
      "adjustment",
      "manual",
      "sale_cancellation",
      "sale_refund",
      "payment_reversal",
      "credit_note",
      "payroll",
    ])
    .optional(),
  sourceId: z.number().optional(),
  isPosted: z.boolean().default(false),
  isReversed: z.boolean().default(false),
  reversalOfId: z.number().optional(),
  postingBatchId: z.number().nullable().optional(),
  totalAmount: z.number().int().min(0),
  currency: z.string().default("IQD"),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
  // Relations
  lines: z.array(JournalLineSchema).optional(),
});

export type Account = z.infer<typeof AccountSchema>;
export type JournalLine = z.infer<typeof JournalLineSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

/**
 * Input type for creating a journal entry.
 * `entryNumber` is optional — when omitted the repository auto-generates a
 * concurrency-safe, sequential number based on the DB-assigned primary key.
 */
export type CreateJournalEntryInput = Omit<JournalEntry, "entryNumber"> & {
  entryNumber?: string;
};
