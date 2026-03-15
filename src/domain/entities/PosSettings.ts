import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
// POS Settings — singleton row for point-of-sale configuration
// ═══════════════════════════════════════════════════════════════

export const PAPER_SIZES = ["thermal", "a4", "a5"] as const;
export const LAYOUT_DIRECTIONS = ["rtl", "ltr"] as const;

export const PosSettingsSchema = z.object({
  id: z.number().optional(),
  invoicePrefix: z.string().default("INV"),
  invoiceTemplateId: z.string().default("default"),
  paperSize: z.enum(PAPER_SIZES).default("thermal"),
  layoutDirection: z.enum(LAYOUT_DIRECTIONS).default("rtl"),
  showQr: z.boolean().default(false),
  showBarcode: z.boolean().default(false),
  invoiceLogo: z.string().default(""),
  invoiceFooterNotes: z.string().default(""),
  defaultPrinterName: z.string().nullable().optional(),
  receiptHeader: z.string().nullable().optional(),
  receiptFooter: z.string().nullable().optional(),
  quickSaleEnabled: z.boolean().default(true),
  soundEnabled: z.boolean().default(true),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.number().nullable().optional(),
});

export type PosSettingsEntity = z.infer<typeof PosSettingsSchema>;

/** Partial update input */
export type UpdatePosSettingsInput = Partial<
  Omit<PosSettingsEntity, "id" | "updatedAt">
>;
