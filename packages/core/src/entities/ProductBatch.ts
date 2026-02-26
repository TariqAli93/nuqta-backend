import { z } from 'zod';

export const ProductBatchSchema = z.object({
  id: z.number().optional(),
  productId: z.number().min(1),
  batchNumber: z.string().min(1),
  expiryDate: z.string().nullable().optional(),
  manufacturingDate: z.string().nullable().optional(),
  quantityReceived: z.number().int().min(0),
  quantityOnHand: z.number().int().min(0),
  costPerUnit: z.number().int().optional(),
  purchaseId: z.number().optional(),
  status: z.enum(['active', 'expired', 'depleted', 'recalled']).default('active'),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});

export type ProductBatch = z.infer<typeof ProductBatchSchema>;
