import { z } from "zod";

export const CustomerLedgerEntrySchema = z.object({
  id: z.number().optional(),
  customerId: z.number().min(1),
  transactionType: z.enum([
    "sale",
    "payment",
    "opening_balance",
    "adjustment",
    "cancellation",
    "refund",
    "payment_reversal",
  ]),
  amount: z.number().int(),
  balanceAfter: z.number().int(),
  saleId: z.number().optional(),
  paymentId: z.number().optional(),
  journalEntryId: z.number().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z.number().optional(),
});

export const SupplierLedgerEntrySchema = z.object({
  id: z.number().optional(),
  supplierId: z.number().min(1),
  transactionType: z.enum([
    "purchase",
    "payment",
    "opening_balance",
    "adjustment",
    "cancellation",
    "refund",
    "payment_reversal",
  ]),
  amount: z.number().int(),
  balanceAfter: z.number().int(),
  purchaseId: z.number().optional(),
  paymentId: z.number().optional(),
  journalEntryId: z.number().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z.number().optional(),
});

export type CustomerLedgerEntry = z.infer<typeof CustomerLedgerEntrySchema>;
export type SupplierLedgerEntry = z.infer<typeof SupplierLedgerEntrySchema>;
