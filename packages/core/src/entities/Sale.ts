import { z } from 'zod';

export const SaleItemSchema = z.object({
  id: z.number().optional(),
  saleId: z.number().optional(),
  productId: z.number().min(1),
  productName: z.string().min(1),
  quantity: z.number().int().min(1),
  unitName: z.string().default('piece'),
  unitFactor: z.number().int().default(1),
  quantityBase: z.number().int().optional(),
  batchId: z.number().optional(),
  unitPrice: z.number().int().min(0),
  discount: z.number().int().default(0),
  subtotal: z.number().int().min(0),
  cogs: z.number().int().optional(),
  weightedAverageCost: z.number().int().optional(),
  createdAt: z.string().datetime().optional(),
});

export const SaleItemDepletionSchema = z.object({
  id: z.number().optional(),
  saleId: z.number().min(1),
  saleItemId: z.number().min(1),
  productId: z.number().min(1),
  batchId: z.number().min(1),
  batchNumber: z.string().optional(),
  expiryDate: z.string().nullable().optional(),
  quantityBase: z.number().int().min(1),
  costPerUnit: z.number().int().min(0),
  totalCost: z.number().int().min(0),
  createdAt: z.string().optional(),
});

export const SaleItemWithDepletionsSchema = SaleItemSchema.extend({
  depletions: z.array(SaleItemDepletionSchema).optional(),
});

export const SaleSchema = z.object({
  id: z.number().optional(),
  invoiceNumber: z.string().min(1),
  customerId: z.number().nullable().optional(),
  subtotal: z.number().int().min(0),
  discount: z.number().int().default(0),
  tax: z.number().int().default(0),
  total: z.number().int().min(0),
  currency: z.string().default('IQD'),
  exchangeRate: z.number().default(1),
  interestRate: z.number().int().default(0),
  interestAmount: z.number().int().default(0),
  paymentType: z.enum(['cash', 'credit', 'mixed']).default('cash'),
  paidAmount: z.number().int().default(0),
  remainingAmount: z.number().int().default(0),
  status: z.enum(['pending', 'completed', 'cancelled']).default('pending'),
  notes: z.string().nullable().optional(),
  idempotencyKey: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
  // Relations
  items: z.array(SaleItemWithDepletionsSchema).optional(),
  cogs: z.number().int().optional(),
  totalCogs: z.number().int().optional(),
  profit: z.number().int().optional(),
  marginBps: z.number().int().optional(),
});

export type SaleItem = z.infer<typeof SaleItemSchema>;
export type SaleItemDepletion = z.infer<typeof SaleItemDepletionSchema>;
export type SaleItemWithDepletions = z.infer<typeof SaleItemWithDepletionsSchema>;
export type Sale = z.infer<typeof SaleSchema>;
