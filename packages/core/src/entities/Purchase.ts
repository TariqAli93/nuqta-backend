import { z } from 'zod';

export const PurchaseItemSchema = z.object({
  id: z.number().optional(),
  purchaseId: z.number().optional(),
  productId: z.number().min(1),
  productName: z.string().min(1),
  unitName: z.string().default('piece'),
  unitFactor: z.number().int().default(1),
  quantity: z.number().int().min(1),
  quantityBase: z.number().int().min(1),
  unitCost: z.number().int().min(0),
  lineSubtotal: z.number().int().min(0),
  discount: z.number().int().default(0),
  batchId: z.number().optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});

export const PurchaseSchema = z.object({
  id: z.number().optional(),
  invoiceNumber: z.string().min(1),
  supplierId: z.number().min(1),
  subtotal: z.number().int().min(0),
  discount: z.number().int().default(0),
  tax: z.number().int().default(0),
  total: z.number().int().min(0),
  paidAmount: z.number().int().default(0),
  remainingAmount: z.number().int().default(0),
  currency: z.string().default('IQD'),
  exchangeRate: z.number().default(1),
  status: z.enum(['pending', 'completed', 'cancelled', 'received', 'partial']).default('pending'),
  notes: z.string().nullable().optional(),
  receivedAt: z.string().datetime().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
  // Relations
  items: z.array(PurchaseItemSchema).optional(),
  payments: z.array(z.any()).optional(),
  movements: z.array(z.any()).optional(),
});

export type PurchaseItem = z.infer<typeof PurchaseItemSchema>;
export type Purchase = z.infer<typeof PurchaseSchema>;
