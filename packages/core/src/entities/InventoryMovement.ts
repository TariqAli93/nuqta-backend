import { z } from 'zod';

export const InventoryMovementSchema = z.object({
  id: z.number().optional(),
  productId: z.number().min(1),
  batchId: z.number().optional(),
  movementType: z.enum(['in', 'out', 'adjust']),
  reason: z.enum(['sale', 'purchase', 'return', 'damage', 'manual', 'opening']),
  quantityBase: z.number().int(),
  unitName: z.string().default('piece'),
  unitFactor: z.number().int().default(1),
  stockBefore: z.number().int(),
  stockAfter: z.number().int(),
  costPerUnit: z.number().int().optional(),
  totalCost: z.number().int().optional(),
  sourceType: z.enum(['sale', 'purchase', 'adjustment', 'return']).optional(),
  sourceId: z.number().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
});

export type InventoryMovement = z.infer<typeof InventoryMovementSchema>;
