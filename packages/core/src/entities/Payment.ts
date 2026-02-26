import { z } from 'zod';

export const PaymentMethodEnum = z.enum(['cash', 'card', 'bank_transfer', 'credit']);
export type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

export const PaymentSchema = z.object({
  id: z.number().optional(),
  saleId: z.number().nullable().optional(),
  purchaseId: z.number().nullable().optional(),
  customerId: z.number().nullable().optional(),
  supplierId: z.number().nullable().optional(),
  amount: z.number().int().min(0),
  currency: z.string().default('IQD'),
  exchangeRate: z.number().default(1),
  paymentMethod: PaymentMethodEnum,
  referenceNumber: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  status: z.enum(['completed', 'voided', 'refunded']).optional(),
  paymentDate: z.string().datetime().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
});

export type Payment = z.infer<typeof PaymentSchema>;
