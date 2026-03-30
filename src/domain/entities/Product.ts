import { z } from "zod";

export const ProductSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  sku: z.string().nullable().optional(),
  barcode: z.string().nullable().optional(),
  categoryId: z.number().nullable().optional(),
  description: z.string().nullable().optional(),
  costPrice: z.number().int().min(0),
  sellingPrice: z.number().int().min(0),
  currency: z.string().default("IQD"),
  stock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  unit: z.string().default("piece"),
  supplierId: z.number().nullable().optional(),
  trackExpiry: z.boolean().default(false),
  status: z
    .enum(["available", "out_of_stock", "discontinued"])
    .default("available"),
  isActive: z.boolean().default(true),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z.number().optional(),
  version: z.number().int().min(1).default(1),
});

export type Product = z.infer<typeof ProductSchema>;
export type ProductInput = z.input<typeof ProductSchema>;
