import { z } from "zod";

// ─── Reconciliation Type ──────────────────────────────────────────────────────

export const ReconciliationTypeSchema = z.enum([
  "customer",
  "supplier",
  "account",
]);
export type ReconciliationType = z.infer<typeof ReconciliationTypeSchema>;

// ─── Reconciliation Status ────────────────────────────────────────────────────

export const ReconciliationStatusSchema = z.enum([
  "open",
  "partially_paid",
  "paid",
]);
export type ReconciliationStatus = z.infer<typeof ReconciliationStatusSchema>;

// ─── Journal Line (enriched for reconciliation) ───────────────────────────────

export const ReconciliableJournalLineSchema = z.object({
  id: z.number(),
  journalEntryId: z.number(),
  accountId: z.number(),
  accountCode: z.string().optional(),
  partnerId: z.number().nullable().optional(),
  debit: z.number().int().default(0),
  credit: z.number().int().default(0),
  balance: z.number().int().default(0),
  description: z.string().nullable().optional(),
  reconciled: z.boolean().default(false),
  reconciliationId: z.number().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  // Relations (populated on fetch)
  entryNumber: z.string().optional(),
  entryDate: z.union([z.string(), z.date()]).optional(),
  sourceType: z.string().nullable().optional(),
  sourceId: z.number().nullable().optional(),
});

export type ReconciliableJournalLine = z.infer<
  typeof ReconciliableJournalLineSchema
>;

// ─── Reconciliation Line ──────────────────────────────────────────────────────

export const ReconciliationLineSchema = z.object({
  id: z.number().optional(),
  reconciliationId: z.number().optional(),
  journalEntryLineId: z.number(),
  amount: z.number().int().min(1),
  createdAt: z.union([z.string(), z.date()]).optional(),
  // Populated on fetch
  journalLine: ReconciliableJournalLineSchema.optional(),
});

export type ReconciliationLine = z.infer<typeof ReconciliationLineSchema>;

// ─── Reconciliation (Header) ──────────────────────────────────────────────────

export const ReconciliationSchema = z.object({
  id: z.number().optional(),
  type: ReconciliationTypeSchema,
  status: ReconciliationStatusSchema.default("open"),
  notes: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z.number().optional(),
  // Populated on fetch
  lines: z.array(ReconciliationLineSchema).optional(),
});

export type Reconciliation = z.infer<typeof ReconciliationSchema>;

// ─── Input/Output DTOs ────────────────────────────────────────────────────────

export interface ReconcileInput {
  /** Journal line IDs to match together (must be same partner + same AR/AP account). */
  journalLineIds: number[];
  /**
   * Optional amounts to apply per line (index-matched to journalLineIds).
   * When omitted the full unreconciled balance of each line is used.
   */
  amounts?: number[];
  notes?: string;
}

export interface UnreconcileInput {
  reconciliationId: number;
}

export interface ReconciliationResult {
  reconciliation: Reconciliation;
  /** Human-readable status: full | partial | overpayment */
  matchType: "full" | "partial" | "overpayment";
  debitTotal: number;
  creditTotal: number;
  difference: number;
}

// ─── Partner Ledger (AR/AP) view ──────────────────────────────────────────────

export interface PartnerLedgerLine {
  journalLineId: number;
  journalEntryId: number;
  entryNumber: string;
  entryDate: string;
  sourceType: string | null;
  sourceId: number | null;
  description: string | null;
  accountId: number;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  balance: number;
  reconciled: boolean;
  reconciliationId: number | null;
  runningBalance: number;
}

export interface PartnerLedger {
  partnerId: number;
  partnerName: string;
  lines: PartnerLedgerLine[];
  totalDebit: number;
  totalCredit: number;
  outstandingBalance: number;
}
