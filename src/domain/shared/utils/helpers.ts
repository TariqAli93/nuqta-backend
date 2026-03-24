import bcrypt from 'bcryptjs';

/**
 * Hash password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error('Password must be a non-empty string');
  }
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

/**
 * Compare plain text password with hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) {
    throw new Error('Password and hash are required');
  }
  return bcrypt.compare(password, hash);
}

/**
 * Enforce money precision by currency.
 * IQD is integer-only and must not be silently rounded.
 */
export function roundByCurrency(amount: number, currency: string): number {
  if (!Number.isFinite(amount)) {
    throw new Error('Amount must be a finite number');
  }

  if (currency === 'IQD' && !Number.isInteger(amount)) {
    throw new Error('IQD amounts must be integers');
  }

  return amount;
}

/**
 * Generate unique invoice number with timestamp and random suffix
 */
export function generateInvoiceNumber(): string {
  const timestamp = Date.now();
  const random = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `INV-${timestamp}-${random}`;
}

export interface SaleItemInput {
  quantity: number;
  unitPrice: number;
  discount?: number;
}

export interface SaleTotals {
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
}

/**
 * Calculate sale totals including discount and tax
 */
/**
 * Derive payment status from paid vs total amounts.
 * Single source of truth for all invoice types (sales & purchases).
 */
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';

export function derivePaymentStatus(paidAmount: number, totalAmount: number): PaymentStatus {
  if (totalAmount <= 0) return 'paid';
  if (paidAmount <= 0) return 'unpaid';
  if (paidAmount >= totalAmount) return 'paid';
  return 'partial';
}

/**
 * Standard financial state shape returned by all invoice-related endpoints.
 * This is the mandatory contract for frontend consumption.
 */
export interface InvoiceFinancialState {
  id: number;
  invoiceNumber: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  paymentStatus: PaymentStatus;
  status: string;
  customerId?: number;
  vendorId?: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Project an entity (Sale or Purchase) into the InvoiceFinancialState contract.
 * The entity must have at minimum: id, invoiceNumber, total, paidAmount,
 * remainingAmount, status, createdAt, updatedAt.
 */
export function toInvoiceFinancialState(entity: {
  id?: number;
  invoiceNumber: string;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  customerId?: number | null;
  supplierId?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}): InvoiceFinancialState {
  const toIso = (v?: string | Date): string => {
    if (!v) return new Date().toISOString();
    const d = v instanceof Date ? v : new Date(v);
    return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  };

  return {
    id: entity.id!,
    invoiceNumber: entity.invoiceNumber,
    totalAmount: entity.total,
    paidAmount: entity.paidAmount,
    remainingAmount: entity.remainingAmount,
    paymentStatus: derivePaymentStatus(entity.paidAmount, entity.total),
    status: entity.status,
    ...(entity.customerId != null ? { customerId: entity.customerId } : {}),
    ...(entity.supplierId != null ? { vendorId: entity.supplierId } : {}),
    createdAt: toIso(entity.createdAt),
    updatedAt: toIso(entity.updatedAt),
  };
}

export function calculateSaleTotals(
  items: SaleItemInput[],
  discount: number = 0,
  tax: number = 0
): SaleTotals {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('Items must be a non-empty array');
  }

  if (!Number.isInteger(discount) || discount < 0) {
    throw new Error('Discount must be a non-negative integer amount');
  }
  if (!Number.isInteger(tax) || tax < 0) {
    throw new Error('Tax must be a non-negative integer amount');
  }

  // Calculate subtotal from all items WITHOUT any discounts
  const subtotalBeforeDiscounts = items.reduce((sum, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
      throw new Error('Item quantity must be a positive integer');
    }
    if (!Number.isInteger(item.unitPrice) || item.unitPrice < 0) {
      throw new Error('Item unit price must be a non-negative integer');
    }
    return sum + item.quantity * item.unitPrice;
  }, 0);

  // Calculate total item-level discounts
  const itemDiscounts = items.reduce((sum, item) => {
    const itemDiscountPerUnit = item.discount || 0;
    if (!Number.isInteger(itemDiscountPerUnit) || itemDiscountPerUnit < 0) {
      throw new Error('Item discount must be a non-negative integer');
    }
    const itemDiscountTotal = itemDiscountPerUnit * (item.quantity || 1);
    return sum + itemDiscountTotal;
  }, 0);

  // Subtotal after item-level discounts
  const subtotalAfterItemDiscounts = subtotalBeforeDiscounts - itemDiscounts;

  // Apply sale-level discount and tax amount (both are integer IQD values)
  const subtotalAfterAllDiscounts = Math.max(0, subtotalAfterItemDiscounts - discount);
  const taxAmount = tax;
  const total = subtotalAfterAllDiscounts + taxAmount;

  return {
    subtotal: subtotalAfterItemDiscounts,
    discount,
    tax: taxAmount,
    total,
  };
}
