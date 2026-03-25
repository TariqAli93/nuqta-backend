/**
 * Tests for payment flow consistency:
 * - Full payment → remainingAmount=0, paymentStatus="paid"
 * - Partial payment → remainingAmount decreases, paymentStatus="partial"
 * - Applies to both sales (AddPaymentUseCase) and purchases (AddPurchasePaymentUseCase)
 */

import { describe, expect, test, vi } from "vitest";
import { AddPaymentUseCase } from "../../../src/domain/use-cases/sales/AddPaymentUseCase.js";
import { AddPurchasePaymentUseCase } from "../../../src/domain/use-cases/purchases/AddPurchasePaymentUseCase.js";
import { derivePaymentStatus } from "../../../src/domain/shared/utils/helpers.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildSaleDeps(total: number, paidAmount: number) {
  const remainingAmount = total - paidAmount;
  const sale = {
    id: 1,
    invoiceNumber: "INV-001",
    total,
    paidAmount,
    remainingAmount,
    customerId: 10,
    status: "pending",
    currency: "IQD",
    exchangeRate: 1,
  };

  let storedPaidAmount = paidAmount;
  let storedRemainingAmount = remainingAmount;
  let storedStatus = "pending";

  const saleRepo = {
    findById: vi.fn(async () => ({
      ...sale,
      paidAmount: storedPaidAmount,
      remainingAmount: storedRemainingAmount,
      status: storedStatus,
      paymentStatus: derivePaymentStatus(storedPaidAmount, total),
    })),
    update: vi.fn(async (_id: number, data: any) => {
      if (data.paidAmount !== undefined) storedPaidAmount = data.paidAmount;
      if (data.remainingAmount !== undefined) storedRemainingAmount = data.remainingAmount;
      if (data.status !== undefined) storedStatus = data.status;
    }),
  };

  const paymentRepo = {
    findByIdempotencyKey: vi.fn(async () => null),
    createSync: vi.fn(async (p: any) => ({ id: 42, ...p })),
  };
  const customerRepo = { updateDebt: vi.fn(async () => {}) };
  const customerLedgerRepo = {
    getLastBalanceSync: vi.fn(async () => 0),
    createSync: vi.fn(async (e: any) => ({ id: 1, ...e })),
  };
  const accountingRepo = {
    findAccountByCode: vi.fn(async () => null),
    createJournalEntrySync: vi.fn(async () => ({ id: 1 })),
  };
  const settingsRepo = {
    get: vi.fn(async (key: string) => {
      if (key === "accounting.enabled") return "false";
      if (key === "ledgers.enabled") return "true";
      return null;
    }),
    set: vi.fn(),
  };

  const mockDb = { transaction: (fn: any) => fn(mockDb) } as any;

  return { saleRepo, paymentRepo, customerRepo, customerLedgerRepo, accountingRepo, settingsRepo, mockDb };
}

function buildPurchaseDeps(total: number, paidAmount: number) {
  const remainingAmount = total - paidAmount;
  const purchase = {
    id: 2,
    invoiceNumber: "PUR-001",
    total,
    paidAmount,
    remainingAmount,
    supplierId: 5,
    status: "received",
    currency: "IQD",
    exchangeRate: 1,
  };

  let storedPaidAmount = paidAmount;
  let storedRemainingAmount = remainingAmount;
  let storedStatus = "received";

  const purchaseRepo = {
    findByIdSync: vi.fn(async () => ({
      ...purchase,
      paidAmount: storedPaidAmount,
      remainingAmount: storedRemainingAmount,
      status: storedStatus,
      paymentStatus: derivePaymentStatus(storedPaidAmount, total),
    })),
    findById: vi.fn(async () => ({
      ...purchase,
      paidAmount: storedPaidAmount,
      remainingAmount: storedRemainingAmount,
      status: storedStatus,
      paymentStatus: derivePaymentStatus(storedPaidAmount, total),
    })),
    updatePaymentSync: vi.fn(async (_id: number, paid: number, remaining: number) => {
      storedPaidAmount = paid;
      storedRemainingAmount = remaining;
    }),
    updateStatusSync: vi.fn(async (_id: number, status: string) => {
      storedStatus = status;
    }),
  };

  const paymentRepo = {
    findByIdempotencyKey: vi.fn(async () => null),
    createSync: vi.fn(async (p: any) => ({ id: 55, ...p })),
  };
  const supplierLedgerRepo = {
    getLastBalanceSync: vi.fn(async () => 0),
    createSync: vi.fn(async (e: any) => ({ id: 1, ...e })),
  };
  const accountingRepo = {
    findAccountByCode: vi.fn(async () => null),
    createJournalEntrySync: vi.fn(async () => ({ id: 1 })),
  };
  const settingsRepo = {
    get: vi.fn(async (key: string) => {
      if (key === "accounting.enabled") return "false";
      if (key === "ledgers.enabled") return "true";
      return null;
    }),
    set: vi.fn(),
  };

  const mockDb = { transaction: (fn: any) => fn(mockDb) } as any;

  return { purchaseRepo, paymentRepo, supplierLedgerRepo, accountingRepo, settingsRepo, mockDb };
}

// ─── Sales (AddPaymentUseCase) ───────────────────────────────────────────────

describe("AddPaymentUseCase — payment status correctness", () => {
  test("full payment: remainingAmount becomes 0 and paymentStatus is 'paid'", async () => {
    const { saleRepo, paymentRepo, customerRepo, customerLedgerRepo, accountingRepo, settingsRepo, mockDb } =
      buildSaleDeps(50000, 0);

    const uc = new AddPaymentUseCase(
      mockDb,
      saleRepo as any,
      paymentRepo as any,
      customerRepo as any,
      customerLedgerRepo as any,
      accountingRepo as any,
      settingsRepo as any,
    );

    const result = await uc.executeCommitPhase({ saleId: 1, amount: 50000, paymentMethod: "cash" }, "1");

    expect(result.updatedSale.remainingAmount).toBe(0);
    expect(result.updatedSale.paidAmount).toBe(50000);
    expect(result.updatedSale.paymentStatus).toBe("paid");
  });

  test("partial payment: remainingAmount decreases and paymentStatus is 'partial'", async () => {
    const { saleRepo, paymentRepo, customerRepo, customerLedgerRepo, accountingRepo, settingsRepo, mockDb } =
      buildSaleDeps(50000, 0);

    const uc = new AddPaymentUseCase(
      mockDb,
      saleRepo as any,
      paymentRepo as any,
      customerRepo as any,
      customerLedgerRepo as any,
      accountingRepo as any,
      settingsRepo as any,
    );

    const result = await uc.executeCommitPhase({ saleId: 1, amount: 20000, paymentMethod: "cash" }, "1");

    expect(result.updatedSale.remainingAmount).toBe(30000);
    expect(result.updatedSale.paidAmount).toBe(20000);
    expect(result.updatedSale.paymentStatus).toBe("partial");
  });

  test("sale.update is called with correct paidAmount and remainingAmount inside transaction", async () => {
    const { saleRepo, paymentRepo, customerRepo, customerLedgerRepo, accountingRepo, settingsRepo, mockDb } =
      buildSaleDeps(50000, 0);

    const uc = new AddPaymentUseCase(
      mockDb,
      saleRepo as any,
      paymentRepo as any,
      customerRepo as any,
      customerLedgerRepo as any,
      accountingRepo as any,
      settingsRepo as any,
    );

    await uc.executeCommitPhase({ saleId: 1, amount: 15000, paymentMethod: "cash" }, "1");

    expect(saleRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ paidAmount: 15000, remainingAmount: 35000 }),
      expect.anything(),
    );
  });
});

// ─── Purchases (AddPurchasePaymentUseCase) ───────────────────────────────────

describe("AddPurchasePaymentUseCase — payment status correctness", () => {
  test("full payment: remainingAmount becomes 0 and paymentStatus is 'paid'", async () => {
    const { purchaseRepo, paymentRepo, supplierLedgerRepo, accountingRepo, settingsRepo, mockDb } =
      buildPurchaseDeps(80000, 0);

    const uc = new AddPurchasePaymentUseCase(
      mockDb,
      purchaseRepo as any,
      paymentRepo as any,
      supplierLedgerRepo as any,
      accountingRepo as any,
      settingsRepo as any,
    );

    const result = await uc.executeCommitPhase({ purchaseId: 2, amount: 80000, paymentMethod: "cash" }, "1");

    expect(result.updatedPurchase.remainingAmount).toBe(0);
    expect(result.updatedPurchase.paidAmount).toBe(80000);
    expect(result.updatedPurchase.paymentStatus).toBe("paid");
  });

  test("partial payment: remainingAmount decreases and paymentStatus is 'partial'", async () => {
    const { purchaseRepo, paymentRepo, supplierLedgerRepo, accountingRepo, settingsRepo, mockDb } =
      buildPurchaseDeps(80000, 0);

    const uc = new AddPurchasePaymentUseCase(
      mockDb,
      purchaseRepo as any,
      paymentRepo as any,
      supplierLedgerRepo as any,
      accountingRepo as any,
      settingsRepo as any,
    );

    const result = await uc.executeCommitPhase({ purchaseId: 2, amount: 40000, paymentMethod: "cash" }, "1");

    expect(result.updatedPurchase.remainingAmount).toBe(40000);
    expect(result.updatedPurchase.paidAmount).toBe(40000);
    expect(result.updatedPurchase.paymentStatus).toBe("partial");
  });

  test("partial payment does not regress purchase status from 'received' to 'pending'", async () => {
    const { purchaseRepo, paymentRepo, supplierLedgerRepo, accountingRepo, settingsRepo, mockDb } =
      buildPurchaseDeps(80000, 0);

    const uc = new AddPurchasePaymentUseCase(
      mockDb,
      purchaseRepo as any,
      paymentRepo as any,
      supplierLedgerRepo as any,
      accountingRepo as any,
      settingsRepo as any,
    );

    await uc.executeCommitPhase({ purchaseId: 2, amount: 40000, paymentMethod: "cash" }, "1");

    // updateStatusSync should NOT be called on partial payment
    expect(purchaseRepo.updateStatusSync).not.toHaveBeenCalled();
  });

  test("full payment advances purchase status to 'completed'", async () => {
    const { purchaseRepo, paymentRepo, supplierLedgerRepo, accountingRepo, settingsRepo, mockDb } =
      buildPurchaseDeps(80000, 0);

    const uc = new AddPurchasePaymentUseCase(
      mockDb,
      purchaseRepo as any,
      paymentRepo as any,
      supplierLedgerRepo as any,
      accountingRepo as any,
      settingsRepo as any,
    );

    await uc.executeCommitPhase({ purchaseId: 2, amount: 80000, paymentMethod: "cash" }, "1");

    expect(purchaseRepo.updateStatusSync).toHaveBeenCalledWith(2, "completed", expect.anything());
  });

  test("updatePaymentSync is called with correct paidAmount and remainingAmount", async () => {
    const { purchaseRepo, paymentRepo, supplierLedgerRepo, accountingRepo, settingsRepo, mockDb } =
      buildPurchaseDeps(80000, 0);

    const uc = new AddPurchasePaymentUseCase(
      mockDb,
      purchaseRepo as any,
      paymentRepo as any,
      supplierLedgerRepo as any,
      accountingRepo as any,
      settingsRepo as any,
    );

    await uc.executeCommitPhase({ purchaseId: 2, amount: 30000, paymentMethod: "cash" }, "1");

    expect(purchaseRepo.updatePaymentSync).toHaveBeenCalledWith(
      2,
      30000,
      50000,
      expect.anything(),
    );
  });
});

// ─── derivePaymentStatus helper ─────────────────────────────────────────────

describe("derivePaymentStatus", () => {
  test("returns 'unpaid' when paidAmount is 0", () => {
    expect(derivePaymentStatus(0, 50000)).toBe("unpaid");
  });

  test("returns 'partial' when paidAmount is between 0 and total", () => {
    expect(derivePaymentStatus(20000, 50000)).toBe("partial");
  });

  test("returns 'paid' when paidAmount equals total", () => {
    expect(derivePaymentStatus(50000, 50000)).toBe("paid");
  });

  test("returns 'paid' when paidAmount exceeds total", () => {
    expect(derivePaymentStatus(60000, 50000)).toBe("paid");
  });
});
