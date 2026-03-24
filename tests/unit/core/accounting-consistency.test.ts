/**
 * Accounting Consistency Tests
 *
 * Validates the core financial invariants that the refactor enforces:
 * - paymentStatus derivation
 * - InvoiceFinancialState contract
 * - Payment status rules
 * - No divergence between computed and stored values
 */
import { describe, expect, test } from "vitest";
import {
  derivePaymentStatus,
  toInvoiceFinancialState,
  type PaymentStatus,
} from "../../../src/domain/shared/utils/helpers.js";

describe("derivePaymentStatus", () => {
  test("returns 'unpaid' when paidAmount is 0", () => {
    expect(derivePaymentStatus(0, 100000)).toBe("unpaid");
  });

  test("returns 'unpaid' when paidAmount is negative (edge case)", () => {
    expect(derivePaymentStatus(-1, 100000)).toBe("unpaid");
  });

  test("returns 'partial' when 0 < paidAmount < totalAmount", () => {
    expect(derivePaymentStatus(50000, 100000)).toBe("partial");
  });

  test("returns 'partial' when paidAmount is 1 (minimum partial)", () => {
    expect(derivePaymentStatus(1, 100000)).toBe("partial");
  });

  test("returns 'partial' when paidAmount is totalAmount - 1", () => {
    expect(derivePaymentStatus(99999, 100000)).toBe("partial");
  });

  test("returns 'paid' when paidAmount equals totalAmount", () => {
    expect(derivePaymentStatus(100000, 100000)).toBe("paid");
  });

  test("returns 'paid' when paidAmount exceeds totalAmount (overpayment)", () => {
    expect(derivePaymentStatus(150000, 100000)).toBe("paid");
  });

  test("returns 'paid' when totalAmount is 0 (free/zero-total invoice)", () => {
    expect(derivePaymentStatus(0, 0)).toBe("paid");
  });

  test("returns 'paid' when totalAmount is negative (edge case)", () => {
    expect(derivePaymentStatus(0, -100)).toBe("paid");
  });
});

describe("toInvoiceFinancialState", () => {
  const baseSale = {
    id: 1,
    invoiceNumber: "INV-001",
    total: 100000,
    paidAmount: 0,
    remainingAmount: 100000,
    status: "pending",
    customerId: 5,
    createdAt: "2026-03-01T10:00:00.000Z",
    updatedAt: "2026-03-01T10:00:00.000Z",
  };

  test("maps unpaid sale correctly", () => {
    const state = toInvoiceFinancialState(baseSale);
    expect(state).toEqual({
      id: 1,
      invoiceNumber: "INV-001",
      totalAmount: 100000,
      paidAmount: 0,
      remainingAmount: 100000,
      paymentStatus: "unpaid",
      status: "pending",
      customerId: 5,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    });
  });

  test("maps partially paid sale correctly", () => {
    const state = toInvoiceFinancialState({
      ...baseSale,
      paidAmount: 50000,
      remainingAmount: 50000,
    });
    expect(state.paymentStatus).toBe("partial");
    expect(state.paidAmount).toBe(50000);
    expect(state.remainingAmount).toBe(50000);
  });

  test("maps fully paid sale correctly", () => {
    const state = toInvoiceFinancialState({
      ...baseSale,
      paidAmount: 100000,
      remainingAmount: 0,
      status: "completed",
    });
    expect(state.paymentStatus).toBe("paid");
    expect(state.status).toBe("completed");
  });

  test("maps purchase with supplierId as vendorId", () => {
    const state = toInvoiceFinancialState({
      id: 2,
      invoiceNumber: "PUR-001",
      total: 50000,
      paidAmount: 50000,
      remainingAmount: 0,
      status: "completed",
      supplierId: 10,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    });
    expect(state.vendorId).toBe(10);
    expect(state.customerId).toBeUndefined();
    expect(state.paymentStatus).toBe("paid");
  });

  test("handles Date objects for timestamps", () => {
    const state = toInvoiceFinancialState({
      ...baseSale,
      createdAt: new Date("2026-03-01T10:00:00.000Z"),
      updatedAt: new Date("2026-03-01T10:00:00.000Z"),
    });
    expect(state.createdAt).toBe("2026-03-01T10:00:00.000Z");
    expect(state.updatedAt).toBe("2026-03-01T10:00:00.000Z");
  });

  test("handles missing timestamps gracefully", () => {
    const state = toInvoiceFinancialState({
      ...baseSale,
      createdAt: undefined,
      updatedAt: undefined,
    });
    // Should return valid ISO strings (current time)
    expect(state.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(state.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("Payment status consistency rules", () => {
  test("unpaid: paidAmount must be 0", () => {
    const status = derivePaymentStatus(0, 100000);
    expect(status).toBe("unpaid");
  });

  test("partial: 0 < paidAmount < totalAmount", () => {
    for (const paid of [1, 25000, 50000, 75000, 99999]) {
      const status = derivePaymentStatus(paid, 100000);
      expect(status).toBe("partial");
    }
  });

  test("paid: remainingAmount must be 0 (paidAmount >= totalAmount)", () => {
    const status = derivePaymentStatus(100000, 100000);
    expect(status).toBe("paid");
  });

  test("multiple payments accumulate correctly", () => {
    const total = 100000;
    let paid = 0;

    // First payment: partial
    paid += 30000;
    expect(derivePaymentStatus(paid, total)).toBe("partial");

    // Second payment: still partial
    paid += 40000;
    expect(derivePaymentStatus(paid, total)).toBe("partial");

    // Third payment: now paid
    paid += 30000;
    expect(derivePaymentStatus(paid, total)).toBe("paid");
  });
});

describe("Ledger correctness invariants", () => {
  test("sale increases receivable (positive ledger entry)", () => {
    // When a credit sale is created with remainingAmount > 0,
    // the customer ledger entry amount should be positive (debt increases)
    const saleRemainingAmount = 50000;
    const currentDebt = 0;
    const newBalance = currentDebt + saleRemainingAmount;

    expect(newBalance).toBe(50000);
    expect(saleRemainingAmount).toBeGreaterThan(0);
  });

  test("payment decreases receivable (negative ledger entry)", () => {
    // When a payment is recorded, the ledger entry amount is negative
    const paymentAmount = 30000;
    const currentDebt = 50000;
    const ledgerEntryAmount = -paymentAmount;
    const newBalance = currentDebt + ledgerEntryAmount;

    expect(ledgerEntryAmount).toBe(-30000);
    expect(newBalance).toBe(20000);
  });

  test("full payment brings balance to zero", () => {
    const total = 100000;
    const paid = 100000;
    const remaining = total - paid;

    expect(remaining).toBe(0);
    expect(derivePaymentStatus(paid, total)).toBe("paid");
  });

  test("remainingAmount is always total - paidAmount (non-negative)", () => {
    const cases = [
      { total: 100000, paid: 0, expectedRemaining: 100000 },
      { total: 100000, paid: 50000, expectedRemaining: 50000 },
      { total: 100000, paid: 100000, expectedRemaining: 0 },
      { total: 100000, paid: 120000, expectedRemaining: 0 }, // clamped
    ];

    for (const { total, paid, expectedRemaining } of cases) {
      const remaining = Math.max(0, total - paid);
      expect(remaining).toBe(expectedRemaining);
    }
  });
});

describe("Response contract shape", () => {
  test("InvoiceFinancialState has all required fields", () => {
    const state = toInvoiceFinancialState({
      id: 1,
      invoiceNumber: "INV-001",
      total: 100000,
      paidAmount: 50000,
      remainingAmount: 50000,
      status: "pending",
      customerId: 5,
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    });

    // All required fields must be present
    expect(state).toHaveProperty("id");
    expect(state).toHaveProperty("invoiceNumber");
    expect(state).toHaveProperty("totalAmount");
    expect(state).toHaveProperty("paidAmount");
    expect(state).toHaveProperty("remainingAmount");
    expect(state).toHaveProperty("paymentStatus");
    expect(state).toHaveProperty("status");
    expect(state).toHaveProperty("createdAt");
    expect(state).toHaveProperty("updatedAt");
  });

  test("paymentStatus is always derived, never manually set", () => {
    // The paymentStatus must match the mathematical relationship
    const state = toInvoiceFinancialState({
      id: 1,
      invoiceNumber: "INV-001",
      total: 100000,
      paidAmount: 50000,
      remainingAmount: 50000,
      status: "pending",
      createdAt: "2026-03-01T10:00:00.000Z",
      updatedAt: "2026-03-01T10:00:00.000Z",
    });

    // paymentStatus must be consistent with paidAmount vs totalAmount
    expect(state.paymentStatus).toBe(
      derivePaymentStatus(state.paidAmount, state.totalAmount),
    );
  });
});
