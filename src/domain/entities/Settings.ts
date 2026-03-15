import { z } from 'zod';

export const CurrencySettingsSchema = z.object({
  id: z.number().optional(),
  currencyCode: z.string().min(1),
  currencyName: z.string().min(1),
  symbol: z.string().min(1),
  exchangeRate: z.number(),
  isBaseCurrency: z.boolean().default(false),
  isActive: z.boolean().default(true),
  updatedAt: z.string().datetime().optional(),
});

export const SettingsSchema = z.object({
  id: z.number().optional(),
  key: z.string().min(1),
  value: z.string().min(1),
  description: z.string().nullable().optional(),
  updatedAt: z.string().datetime().optional(),
  updatedBy: z.number().optional(),
});

export const CompanySettingsSchema = z.object({
  name: z.string().min(1),
  address: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  phone2: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  taxId: z.string().nullable().optional(),
  logo: z.string().nullable().optional(),
  currency: z.string().min(3).max(3), // ISO 4217 currency code
  lowStockThreshold: z.number().int().min(0).default(5),
});

export type CurrencySettings = z.infer<typeof CurrencySettingsSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type CompanySettings = z.infer<typeof CompanySettingsSchema>;
