/**
 * Tests for purchase creation ledger consistency:
 * - Full credit purchase → vendor balance increases by full total
 * - Partial paid purchase → two ledger events, net increase = remainingAmount
 * - Fully paid purchase → two ledger events, net increase = 0
 * - Response reflects final committed state
 */

import { describe, expect, test, vi } from "vitest";
import { CreatePurchaseUseCase } from "../../../src/domain/use-cases/purchases/CreatePurchaseUseCase.js";
import { derivePaymentStatus } from "../../../src/domain/shared/utils/helpers.js";

// ─── Mock builder ────────────────────────────────────────────────────────────

function buildDeps() {
  let nextPurchaseId = 100;
  const ledgerEntries: { transactionType: string; amount: number; balanceAfter: number }[] = [];

  const purchaseRepo = {
    findByIdempotencyKey: vi.fn(async () => null),
    createSync: vi.fn(async (p: any) => ({
      ...p,
      id: nextPurchaseId++,
    })),
    findById: vi.fn(async (id: number) => null),
  };

  const supplierRepo = {
    findById: vi.fn(async () => ({ id: 5, name: "Test Supplier", currentBalance: 0 })),
  };

  const paymentRepo = {
    createSync: vi.fn(async (p: any) => ({ id: 200, ...p })),
  };

  const supplierLedgerRepo = {
    getLastBalanceSync: vi.fn(async () => {
      // Return the last recorded balance (simulating sequential reads within tx)
      if (ledgerEntries.length === 0) return 0;
      return ledgerEntries[ledgerEntries.length - 1].balanceAfter;
    }),
    createSync: vi.fn(async (e: any) => {
      ledgerEntries.push({ transactionType: e.transactionType, amount: e.amount, balanceAfter: e.balanceAfter });
      return { id: ledgerEntries.length, ...e };
    }),
  };

  const accountingRepo = {
    findAccountByCode: vi.fn(async () => null),
    createJournalEntrySync: vi.fn(async () => ({ id: 1 })),
  };

  const settingsRepo = {
    get: vi.fn(async (key: string) => {
      if (key === "modules.accounting.enabled") return "false";
      if (key === "modules.ledgers.enabled") return "true";
      return null;
    }),
    set: vi.fn(),
  };

  const mockDb = { transaction: (fn: any) => fn(mockDb) } as any;

  return {
    purchaseRepo,
    supplierRepo,
    paymentRepo,
    supplierLedgerRepo,
    accountingRepo,
    settingsRepo,
    mockDb,
    ledgerEntries,
  };
}

function buildUseCase(deps: ReturnType<typeof buildDeps>) {
  return new CreatePurchaseUseCase(
    deps.mockDb,
    deps.purchaseRepo as any,
    deps.supplierRepo as any,
    deps.paymentRepo as any,
    deps.supplierLedgerRepo as any,
    deps.accountingRepo as any,
    deps.settingsRepo as any,
  );
}

const baseInput = {
  invoiceNumber: "PUR-TEST-001",
  supplierId: 5,
  items: [{ productId: 10, quantity: 1, unitCost: 100000 }],
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("CreatePurchaseUseCase — vendor ledger consistency", () => {
  test("full credit purchase: ONE purchase ledger entry for full total, vendor balance increases by total", async () => {
    const deps = buildDeps();
    const uc = buildUseCase(deps);

    const result = await uc.executeCommitPhase({ ...baseInput, paidAmount: 0 }, "1");

    // Should have exactly ONE ledger entry (purchase type)
    expect(deps.ledgerEntries).toHaveLength(1);
    expect(deps.ledgerEntries[0].transactionType).toBe("purchase");
    expect(deps.ledgerEntries[0].amount).toBe(100000);
    expect(deps.ledgerEntries[0].balanceAfter).toBe(100000);

    // Purchase state
    expect(result.createdPurchase.paidAmount).toBe(0);
    expect(result.createdPurchase.remainingAmount).toBe(100000);
    expect(derivePaymentStatus(0, 100000)).toBe("unpaid");
  });

  test("partial paid purchase: TWO ledger events, net vendor balance = remainingAmount", async () => {
    const deps = buildDeps();
    const uc = buildUseCase(deps);

    const result = await uc.executeCommitPhase({ ...baseInput, paidAmount: 30000 }, "1");

    // Should have TWO ledger entries
    expect(deps.ledgerEntries).toHaveLength(2);

    const purchaseEntry = deps.ledgerEntries[0];
    expect(purchaseEntry.transactionType).toBe("purchase");
    expect(purchaseEntry.amount).toBe(100000);  // full total
    expect(purchaseEntry.balanceAfter).toBe(100000);

    const paymentEntry = deps.ledgerEntries[1];
    expect(paymentEntry.transactionType).toBe("payment");
    expect(paymentEntry.amount).toBe(-30000);  // negative (reduces balance)
    expect(paymentEntry.balanceAfter).toBe(70000);  // net = remainingAmount

    // Net balance increase = 70000 (remainingAmount)
    expect(deps.ledgerEntries[1].balanceAfter).toBe(70000);

    // Purchase state
    expect(result.createdPurchase.paidAmount).toBe(30000);
    expect(result.createdPurchase.remainingAmount).toBe(70000);
    expect(derivePaymentStatus(30000, 100000)).toBe("partial");
  });

  test("fully paid purchase: TWO ledger events, net vendor balance increase = 0", async () => {
    const deps = buildDeps();
    const uc = buildUseCase(deps);

    const result = await uc.executeCommitPhase({ ...baseInput, paidAmount: 100000 }, "1");

    // Should have TWO ledger entries even when fully paid
    expect(deps.ledgerEntries).toHaveLength(2);

    const purchaseEntry = deps.ledgerEntries[0];
    expect(purchaseEntry.transactionType).toBe("purchase");
    expect(purchaseEntry.amount).toBe(100000);

    const paymentEntry = deps.ledgerEntries[1];
    expect(paymentEntry.transactionType).toBe("payment");
    expect(paymentEntry.amount).toBe(-100000);
    expect(paymentEntry.balanceAfter).toBe(0);  // net = 0, no outstanding

    // Purchase state
    expect(result.createdPurchase.paidAmount).toBe(100000);
    expect(result.createdPurchase.remainingAmount).toBe(0);
    expect(derivePaymentStatus(100000, 100000)).toBe("paid");
  });

  test("full credit purchase: no payment record created", async () => {
    const deps = buildDeps();
    const uc = buildUseCase(deps);

    await uc.executeCommitPhase({ ...baseInput, paidAmount: 0 }, "1");

    expect(deps.paymentRepo.createSync).not.toHaveBeenCalled();
  });

  test("partial paid purchase: payment record created for paidAmount", async () => {
    const deps = buildDeps();
    const uc = buildUseCase(deps);

    await uc.executeCommitPhase({ ...baseInput, paidAmount: 30000 }, "1");

    expect(deps.paymentRepo.createSync).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 30000 }),
      expect.anything(),
    );
  });

  test("ledger purchase entry amount always equals full total (not remainingAmount)", async () => {
    const deps = buildDeps();
    const uc = buildUseCase(deps);

    // Partial: paidAmount=40000, total=100000, remaining=60000
    await uc.executeCommitPhase({ ...baseInput, paidAmount: 40000 }, "1");

    const purchaseEntry = deps.ledgerEntries[0];
    // Must be total (100000), NOT remainingAmount (60000)
    expect(purchaseEntry.amount).toBe(100000);
    expect(purchaseEntry.amount).not.toBe(60000);
  });

  test("purchase ledger entry created even when ledgers balance starts non-zero", async () => {
    const deps = buildDeps();
    // Simulate supplier already has 50000 balance
    deps.supplierLedgerRepo.getLastBalanceSync = vi.fn(async () => {
      if (deps.ledgerEntries.length === 0) return 50000; // starting balance
      return deps.ledgerEntries[deps.ledgerEntries.length - 1].balanceAfter;
    });

    const uc = buildUseCase(deps);
    await uc.executeCommitPhase({ ...baseInput, paidAmount: 0 }, "1");

    expect(deps.ledgerEntries[0].balanceAfter).toBe(150000); // 50000 + 100000
  });
});
