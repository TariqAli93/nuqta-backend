import { z } from "zod";

export const SaleReceiptStoreSchema = z.object({
  companyName: z.string().default(""),
  companyNameAr: z.string().default(""),
  phone: z.string().default(""),
  mobile: z.string().default(""),
  address: z.string().default(""),
  receiptWidth: z.string().default("80mm"),
  footerNote: z.string().default(""),
});

export const SaleReceiptCustomerSchema = z.object({
  id: z.number().nullable(),
  name: z.string().default(""),
  phone: z.string().default(""),
});

export const SaleReceiptCashierSchema = z.object({
  id: z.number().nullable(),
  name: z.string().default(""),
});

export const SaleReceiptBranchSchema = z.object({
  id: z.number().nullable(),
  name: z.string().default(""),
});

export const SaleReceiptItemSchema = z.object({
  productId: z.number().nullable(),
  productName: z.string().default(""),
  quantity: z.number().int().min(0),
  unitPrice: z.number().int().min(0),
  subtotal: z.number().int().min(0),
  discount: z.number().int().min(0).default(0),
  tax: z.number().int().min(0).default(0),
});

export const SaleReceiptSchema = z.object({
  saleId: z.number().int().min(1),
  invoiceNumber: z.string().min(1),
  createdAt: z.string().datetime(),
  subtotal: z.number().int().min(0),
  discount: z.number().int().min(0).default(0),
  tax: z.number().int().min(0).default(0),
  total: z.number().int().min(0),
  currency: z.string().min(1),
  customer: SaleReceiptCustomerSchema,
  cashier: SaleReceiptCashierSchema,
  branch: SaleReceiptBranchSchema,
  store: SaleReceiptStoreSchema,
  items: z.array(SaleReceiptItemSchema),
  receiptText: z.string().optional(),
});

export type SaleReceiptStore = z.infer<typeof SaleReceiptStoreSchema>;
export type SaleReceiptCustomer = z.infer<typeof SaleReceiptCustomerSchema>;
export type SaleReceiptCashier = z.infer<typeof SaleReceiptCashierSchema>;
export type SaleReceiptBranch = z.infer<typeof SaleReceiptBranchSchema>;
export type SaleReceiptItem = z.infer<typeof SaleReceiptItemSchema>;
export type SaleReceipt = z.infer<typeof SaleReceiptSchema>;
