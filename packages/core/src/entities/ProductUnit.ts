import { z } from 'zod';

export const ProductUnitSchema = z.object({
  id: z.number().optional(),
  productId: z.number().min(1),
  unitName: z.string().min(1),
  factorToBase: z.number().int().min(1).default(1),
  barcode: z.string().nullable().optional(),
  sellingPrice: z.number().int().nullable().optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
});

export type ProductUnit = z.infer<typeof ProductUnitSchema>;
