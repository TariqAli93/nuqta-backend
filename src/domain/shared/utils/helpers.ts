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
