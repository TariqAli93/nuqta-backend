import { z } from "zod";

export const SalesInvoicePaymentSchema = z.object({
  id: z.number().optional(),
  invoiceId: z.number().int().min(1),
  customerId: z.number().int().optional(),
  amount: z.number().int().min(1),
  paymentMethod: z.string().min(1),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentDate: z.union([z.string(), z.date()]).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export const PurchaseInvoicePaymentSchema = z.object({
  id: z.number().optional(),
  invoiceId: z.number().int().min(1),
  supplierId: z.number().int().optional(),
  amount: z.number().int().min(1),
  paymentMethod: z.string().min(1),
  reference: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  paymentDate: z.union([z.string(), z.date()]).optional(),
  createdAt: z.union([z.string(), z.date()]).optional(),
});

export type SalesInvoicePayment = z.infer<typeof SalesInvoicePaymentSchema>;
export type PurchaseInvoicePayment = z.infer<
  typeof PurchaseInvoicePaymentSchema
>;
