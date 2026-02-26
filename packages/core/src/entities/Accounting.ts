import { z } from 'zod';

export const AccountSchema = z.object({
  id: z.number().optional(),
  code: z.string().min(1),
  name: z.string().min(1),
  nameAr: z.string().nullable().optional(),
  accountType: z.enum(['asset', 'liability', 'equity', 'revenue', 'expense']),
  parentId: z.number().nullable().optional(),
  isSystem: z.boolean().default(false),
  isActive: z.boolean().default(true),
  balance: z.number().int().default(0),
  createdAt: z.string().datetime().optional(),
});

export const JournalLineSchema = z.object({
  id: z.number().optional(),
  journalEntryId: z.number().optional(),
  accountId: z.number().min(1),
  debit: z.number().int().default(0),
  credit: z.number().int().default(0),
  description: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});

export const JournalEntrySchema = z.object({
  id: z.number().optional(),
  entryNumber: z.string().min(1),
  entryDate: z.string(),
  description: z.string().min(1),
  sourceType: z.enum(['sale', 'purchase', 'payment', 'adjustment', 'manual']).optional(),
  sourceId: z.number().optional(),
  isPosted: z.boolean().default(false),
  isReversed: z.boolean().default(false),
  reversalOfId: z.number().optional(),
  postingBatchId: z.number().nullable().optional(),
  totalAmount: z.number().int().min(0),
  currency: z.string().default('IQD'),
  notes: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
  // Relations
  lines: z.array(JournalLineSchema).optional(),
});

export type Account = z.infer<typeof AccountSchema>;
export type JournalLine = z.infer<typeof JournalLineSchema>;
export type JournalEntry = z.infer<typeof JournalEntrySchema>;
