import { z } from 'zod';

export const BarcodeLayoutElementSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['barcode', 'productName', 'price', 'expiry']),
    x: z.number().int().min(0),
    y: z.number().int().min(0),
    width: z.number().int().positive().optional(),
    height: z.number().int().positive().optional(),
    fontSize: z.number().int().positive().optional(),
    bold: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'barcode') {
      if (!value.width || !value.height) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Barcode elements require width and height',
        });
      }
    }
  });

export const BarcodeLayoutV1Schema = z.object({
  version: z.literal(1),
  elements: z.array(BarcodeLayoutElementSchema),
});

const LegacyBarcodeLayoutSchema = z.object({
  elements: z.array(BarcodeLayoutElementSchema),
});

export const BarcodeTemplateSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(1),
  width: z.number().int().min(1),
  height: z.number().int().min(1),
  barcodeType: z.enum(['CODE128', 'EAN13', 'QR']).default('CODE128'),
  showPrice: z.boolean().default(true),
  showName: z.boolean().default(true),
  showBarcode: z.boolean().default(true),
  showExpiry: z.boolean().default(false),
  layoutJson: z.string().nullable().optional(),
  isDefault: z.boolean().default(false),
  createdAt: z.string().datetime().optional(),
});

export const BarcodePrintJobSchema = z.object({
  id: z.number().optional(),
  templateId: z.number().min(1),
  productId: z.number().min(1),
  productName: z.string().min(1),
  barcode: z.string().nullable().optional(),
  price: z.number().int().optional(),
  expiryDate: z.string().nullable().optional(),
  quantity: z.number().int().min(1).default(1),
  status: z.enum(['pending', 'printing', 'printed', 'failed']).default('pending'),
  printedAt: z.string().datetime().nullable().optional(),
  printError: z.string().nullable().optional(),
  createdAt: z.string().datetime().optional(),
  createdBy: z.number().optional(),
});

export type BarcodeTemplate = z.infer<typeof BarcodeTemplateSchema>;
export type BarcodePrintJob = z.infer<typeof BarcodePrintJobSchema>;
export type BarcodeLayoutV1 = z.infer<typeof BarcodeLayoutV1Schema>;

/**
 * Validates and normalizes layout JSON to schema version 1.
 * Legacy payloads without `version` are upgraded automatically.
 */
export function normalizeBarcodeLayoutJson(layoutJson?: string | null): string | null {
  if (!layoutJson) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(layoutJson);
  } catch {
    throw new Error('layoutJson must be valid JSON');
  }

  const v1 = BarcodeLayoutV1Schema.safeParse(parsed);
  if (v1.success) {
    return JSON.stringify(v1.data);
  }

  const legacy = LegacyBarcodeLayoutSchema.safeParse(parsed);
  if (legacy.success) {
    return JSON.stringify({
      version: 1,
      elements: legacy.data.elements,
    } satisfies BarcodeLayoutV1);
  }

  throw new Error('layoutJson does not match supported barcode layout schema');
}
