import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// Posting Batch Entity — groups journal entries posted together
// ═══════════════════════════════════════════════════════════════

export const PostingBatchSchema = z.object({
  id: z.number().optional(),
  periodType: z.enum(['day', 'month', 'year']),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  entriesCount: z.number().int().min(0).default(0),
  totalAmount: z.number().int().min(0).default(0),
  status: z.enum(['draft', 'posted', 'locked']).default('posted'),
  postedAt: z.string().optional(),
  postedBy: z.number().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.string().optional(),
});

export type PostingBatch = z.infer<typeof PostingBatchSchema>;
