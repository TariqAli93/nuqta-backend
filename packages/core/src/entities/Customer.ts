import { z } from "zod";

export const CustomerSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  totalPurchases: z.number().int().default(0),
  totalDebt: z.number().int().default(0),
  isActive: z.boolean().default(true),
  createdAt: z.union([z.string(), z.date()]).optional(),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  createdBy: z.number().optional(),
});

export type Customer = z.infer<typeof CustomerSchema>;
