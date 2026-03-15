import { z } from "zod";

// ═══════════════════════════════════════════════════════════════
// Barcode Settings — singleton row for barcode configuration
// ═══════════════════════════════════════════════════════════════

export const BARCODE_TYPES = [
  "CODE128",
  "EAN13",
  "QR",
  "CODE39",
  "UPC",
] as const;
export const BARCODE_ENCODINGS = ["UTF-8", "ASCII", "ISO-8859-1"] as const;

export const BarcodeSettingsSchema = z.object({
  id: z.number().optional(),
  defaultBarcodeType: z.enum(BARCODE_TYPES).default("CODE128"),
  defaultWidth: z.number().int().min(1).default(200),
  defaultHeight: z.number().int().min(1).default(100),
  showPrice: z.boolean().default(true),
  showProductName: z.boolean().default(true),
  showExpiryDate: z.boolean().default(false),
  encoding: z.enum(BARCODE_ENCODINGS).default("UTF-8"),
  printDpi: z.number().int().min(72).default(203),
  labelWidthMm: z.number().int().min(1).default(50),
  labelHeightMm: z.number().int().min(1).default(30),
  marginTop: z.number().int().min(0).default(2),
  marginBottom: z.number().int().min(0).default(2),
  marginLeft: z.number().int().min(0).default(2),
  marginRight: z.number().int().min(0).default(2),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.number().nullable().optional(),
});

export type BarcodeSettingsEntity = z.infer<typeof BarcodeSettingsSchema>;

/** Partial update input */
export type UpdateBarcodeSettingsInput = Partial<
  Omit<BarcodeSettingsEntity, "id" | "updatedAt">
>;
