/**
 * Supplier balance synchronization tests
 *
 * Invariant under test:
 *   supplier.currentBalance must equal the sum of all outstanding (remaining)
 *   amounts across all active purchases for that supplier.
 *
 * Core delta rule:
 *   supplier.currentBalance += (newRemainingAmount - oldRemainingAmount)
 *
 * Scenarios covered:
 *  1. Unpaid purchase creation  → balance increases by full total
 *  2. Partial-paid purchase     → balance increases only by remainingAmount
 *  3. Fully-paid purchase       → balance unchanged (delta = 0)
 *  4. Register additional pay.  → balance decreases by payment amount
 *  5. Final payment settles it  → balance reaches zero for that purchase
 */

import { describe, expect, test, vi, beforeEach } from "vitest";
import { CreatePurchaseUseCase } from "../../../src/domain/use-cases/purchases/CreatePurchaseUseCase.js";
import { AddPurchasePaymentUseCase } from "../../../src/domain/use-cases/purchases/AddPurchasePaymentUseCase.js";

// ─── Shared mock builder ───────────────────────────────────────────────────

function buildDeps(initialSupplierBalance = 0) {
  let supplierBalance = initialSupplierBalance;
  let nextPurchaseId = 100;
  let nextPaymentId = 200;
  const ledgerEntries: { transactionType: string; amount: number; balanceAfter: number }[] = [];

  const purchaseStore: Record<number, { id: number; total: number; paidAmount: number; remainingAmount: number; supplierId: number; status: string }> = {};

  const purchaseRepo = {
    findByIdempotencyKey: vi.fn(async () => null),
    createSync: vi.fn(async (p: any) => {
      const id = nextPurchaseId++;
      purchaseStore[id] = { id, total: p.total, paidAmount: p.paidAmount, remainingAmount: p.remainingAmount, supplierId: p.supplierId, status: p.status };
      return { ...p, id };
    }),
    findById: vi.fn(async (id: number, _tx?: any) => {
      const row = purchaseStore[id];
      if (!row) return null;
      return { ...row, currency: "IQD", exchangeRate: 1 };
    }),
    findByIdSync: vi.fn(async (id: number, _tx?: any) => {
      const row = purchaseStore[id];
      if (!row) return null;
      return { ...row, currency: "IQD", exchangeRate: 1 };
    }),
    updatePaymentSync: vi.fn(async (id: number, paidAmount: number, remainingAmount: number) => {
      if (purchaseStore[id]) {
        purchaseStore[id].paidAmount = paidAmount;
        purchaseStore[id].remainingAmount = remainingAmount;
      }
    }),
    updatePayment: vi.fn(async (id: number, paidAmount: number, remainingAmount: number) => {
      if (purchaseStore[id]) {
        purchaseStore[id].paidAmount = paidAmount;
        purchaseStore[id].remainingAmount = remainingAmount;
      }
    }),
    updateStatusSync: vi.fn(async (id: number, status: string) => {
      if (purchaseStore[id]) purchaseStore[id].status = status;
    }),
    updateStatus: vi.fn(async (id: number, status: string) => {
      if (purchaseStore[id]) purchaseStore[id].status = status;
    }),
  };

  const supplierRepo = {
    findById: vi.fn(async () => ({ id: 5, name: "Test Supplier", currentBalance: supplierBalance })),
    findByIdSync: vi.fn(async () => ({ id: 5, name: "Test Supplier", currentBalance: supplierBalance })),
    updatePayable: vi.fn(async (id: number, amountChange: number, _tx?: any) => {
      supplierBalance += amountChange;
    }),
  };

  const paymentRepo = {
    findByIdempotencyKey: vi.fn(async () => null),
    createSync: vi.fn(async (p: any) => ({ id: nextPaymentId++, ...p })),
  };

  const supplierLedgerRepo = {
    getLastBalanceSync: vi.fn(async () => {
      if (ledgerEntries.length === 0) return initialSupplierBalance;
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

  const getSupplierBalance = () => supplierBalance;

  return {
    purchaseRepo,
    supplierRepo,
    paymentRepo,
    supplierLedgerRepo,
    accountingRepo,
    settingsRepo,
    mockDb,
    ledgerEntries,
    purchaseStore,
    getSupplierBalance,
  };
}

function buildCreateUseCase(deps: ReturnType<typeof buildDeps>) {
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

function buildPaymentUseCase(deps: ReturnType<typeof buildDeps>) {
  return new AddPurchasePaymentUseCase(
    deps.mockDb,
    deps.purchaseRepo as any,
    deps.paymentRepo as any,
    deps.supplierLedgerRepo as any,
    deps.accountingRepo as any,
    deps.settingsRepo as any,
    undefined, // auditRepo
    undefined, // accountingSettingsRepo
    deps.supplierRepo as any,
  );
}

const baseItem = { productId: 10, quantity: 1, unitCost: 100_000 };
const baseInput = { invoiceNumber: "PUR-BAL-001", supplierId: 5, items: [baseItem] };

// ─── Create purchase tests ────────────────────────────────────────────────

describe("CreatePurchaseUseCase — supplier.currentBalance synchronization", () => {
  test("unpaid purchase: supplier balance increases by full total", async () => {
    const deps = buildDeps(0);
    const uc = buildCreateUseCase(deps);

    await uc.executeCommitPhase({ ...baseInput, paidAmount: 0 }, "1");

    expect(deps.supplierRepo.updatePayable).toHaveBeenCalledOnce();
    expect(deps.supplierRepo.updatePayable).toHaveBeenCalledWith(5, 100_000, expect.anything());
    expect(deps.getSupplierBalance()).toBe(100_000);
  });

  test("partial-paid purchase: supplier balance increases only by remainingAmount", async () => {
    const deps = buildDeps(0);
    const uc = buildCreateUseCase(deps);

    await uc.executeCommitPhase({ ...baseInput, paidAmount: 30_000 }, "1");

    // delta = remainingAmount = 70_000
    expect(deps.supplierRepo.updatePayable).toHaveBeenCalledWith(5, 70_000, expect.anything());
    expect(deps.getSupplierBalance()).toBe(70_000);
  });

  test("fully-paid purchase: supplier balance does not change", async () => {
    const deps = buildDeps(0);
    const uc = buildCreateUseCase(deps);

    await uc.executeCommitPhase({ ...baseInput, paidAmount: 100_000 }, "1");

    // remainingAmount = 0 → syncSupplierBalance short-circuits at delta=0
    expect(deps.supplierRepo.updatePayable).not.toHaveBeenCalled();
    expect(deps.getSupplierBalance()).toBe(0);
  });

  test("supplier balance accumulates correctly across multiple purchases", async () => {
    const deps = buildDeps(0);
    const uc = buildCreateUseCase(deps);

    // Purchase 1: total=100_000, paid=0 → remaining=100_000
    await uc.executeCommitPhase({ ...baseInput, invoiceNumber: "P1", paidAmount: 0 }, "1");
    // Purchase 2: total=100_000, paid=40_000 → remaining=60_000
    await uc.executeCommitPhase({ ...baseInput, invoiceNumber: "P2", paidAmount: 40_000 }, "1");

    expect(deps.getSupplierBalance()).toBe(160_000);
  });
});

// ─── AddPurchasePayment tests ─────────────────────────────────────────────

describe("AddPurchasePaymentUseCase — supplier.currentBalance synchronization", () => {
  test("registering a payment reduces supplier balance by the payment amount", async () => {
    const deps = buildDeps(70_000); // supplier already has 70_000 outstanding
    const createUc = buildCreateUseCase(deps);
    const payUc = buildPaymentUseCase(deps);

    // Create the purchase that established the 70_000 balance
    const { createdPurchase } = await createUc.executeCommitPhase(
      { ...baseInput, paidAmount: 30_000 },
      "1",
    );
    // Reset mock call counts after setup (we only care about the payment step)
    deps.supplierRepo.updatePayable.mockClear();

    await payUc.executeCommitPhase(
      { purchaseId: createdPurchase.id!, amount: 20_000, paymentMethod: "cash" },
      "1",
    );

    expect(deps.supplierRepo.updatePayable).toHaveBeenCalledWith(5, -20_000, expect.anything());
    // Balance after: 70_000 (initial for this test) + 70_000 (purchase) - 20_000 (payment) = 120_000
    // But since we cleared the mock and test deps start at 70_000, then createUc adds 70_000 → 140_000,
    // then payUc subtracts 20_000 → 120_000.
    expect(deps.getSupplierBalance()).toBe(120_000);
  });

  test("final payment settles purchase — supplier balance reaches zero for that purchase", async () => {
    const deps = buildDeps(0);
    const createUc = buildCreateUseCase(deps);
    const payUc = buildPaymentUseCase(deps);

    // Create unpaid purchase of 100_000
    const { createdPurchase } = await createUc.executeCommitPhase(
      { ...baseInput, paidAmount: 0 },
      "1",
    );
    expect(deps.getSupplierBalance()).toBe(100_000);

    // Pay in full
    await payUc.executeCommitPhase(
      { purchaseId: createdPurchase.id!, amount: 100_000, paymentMethod: "cash" },
      "1",
    );

    expect(deps.getSupplierBalance()).toBe(0);
  });

  test("partial payment sequence converges to zero outstanding", async () => {
    const deps = buildDeps(0);
    const createUc = buildCreateUseCase(deps);
    const payUc = buildPaymentUseCase(deps);

    const { createdPurchase } = await createUc.executeCommitPhase(
      { ...baseInput, paidAmount: 0 },
      "1",
    );
    expect(deps.getSupplierBalance()).toBe(100_000);

    // Pay 40_000
    await payUc.executeCommitPhase(
      { purchaseId: createdPurchase.id!, amount: 40_000, paymentMethod: "cash" },
      "1",
    );
    expect(deps.getSupplierBalance()).toBe(60_000);

    // Pay remaining 60_000
    await payUc.executeCommitPhase(
      { purchaseId: createdPurchase.id!, amount: 60_000, paymentMethod: "cash" },
      "1",
    );
    expect(deps.getSupplierBalance()).toBe(0);
  });

  test("supplier balance not updated when supplierRepo is not injected (backward-compat)", async () => {
    const deps = buildDeps(0);
    // Omit supplierRepo (9th argument) to simulate old wiring
    const payUcNoSupplier = new AddPurchasePaymentUseCase(
      deps.mockDb,
      deps.purchaseRepo as any,
      deps.paymentRepo as any,
      deps.supplierLedgerRepo as any,
      deps.accountingRepo as any,
      deps.settingsRepo as any,
    );

    // Seed a purchase manually
    const purchaseId = 100;
    deps.purchaseStore[purchaseId] = {
      id: purchaseId,
      total: 50_000,
      paidAmount: 0,
      remainingAmount: 50_000,
      supplierId: 5,
      status: "pending",
    };

    // Should not throw; simply skips balance update
    await expect(
      payUcNoSupplier.executeCommitPhase(
        { purchaseId, amount: 10_000, paymentMethod: "cash" },
        "1",
      ),
    ).resolves.toBeDefined();

    expect(deps.supplierRepo.updatePayable).not.toHaveBeenCalled();
  });
});
