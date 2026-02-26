import { z } from 'zod';

export const CategorySchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  isActive: z.boolean().default(true),
  createdAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
});

export type Category = z.infer<typeof CategorySchema>;
