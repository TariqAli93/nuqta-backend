import { z } from 'zod';

export const ProductSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  categoryId: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  costPrice: z.number().int().min(0),
  sellingPrice: z.number().int().min(0),
  currency: z.string().default('IQD'),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  unit: z.string().default('piece'),
  supplier: z.string().nullable().optional(),
  supplierId: z.number().nullable().optional(),
  expireDate: z.string().nullable().optional(),
  isExpire: z.boolean().default(false),
  status: z.enum(['available', 'out_of_stock', 'discontinued']).default('available'),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
});

export type Product = z.infer<typeof ProductSchema>;
export type ProductInput = z.input<typeof ProductSchema>;
