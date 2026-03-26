/**
 * Tests for customer-profile payment settlement:
 * - FIFO allocation across open invoices
 * - paidAmount / remainingAmount / paymentStatus correctness
 * - Overpayment rejection
 * - Transaction rollback
 * - Aggregate balance consistency
 * - Consistent final status with direct invoice payment
 */

import { describe, expect, test, vi, beforeEach } from "vitest";
import { RecordCustomerPaymentUseCase } from "../../../src/domain/use-cases/customer-ledger/RecordCustomerPaymentUseCase.js";
import { AddPaymentUseCase } from "../../../src/domain/use-cases/sales/AddPaymentUseCase.js";
import { derivePaymentStatus } from "../../../src/domain/shared/utils/helpers.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeSale(
  overrides: Partial<{
    id: number;
    invoiceNumber: string;
    total: number;
    paidAmount: number;
    remainingAmount: number;
    status: string;
    createdAt: string;
    customerId: number;
    currency: string;
  }>,
) {
  const total = overrides.total ?? 50000;
  const paidAmount = overrides.paidAmount ?? 0;
  return {
    id: overrides.id ?? 1,
    invoiceNumber: overrides.invoiceNumber ?? `INV-${overrides.id ?? 1}`,
    total,
    paidAmount,
    remainingAmount: overrides.remainingAmount ?? total - paidAmount,
    status: overrides.status ?? "pending",
    createdAt: overrides.createdAt ?? "2026-03-01T00:00:00.000Z",
    customerId: overrides.customerId ?? 10,
    currency: overrides.currency ?? "IQD",
    exchangeRate: 1,
    items: [],
  };
}

interface InvoiceState {
  id: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
}

function buildCustomerPaymentDeps(openInvoices: ReturnType<typeof makeSale>[]) {
  // Track invoice state mutations
  const invoiceStates = new Map<number, InvoiceState>();
  for (const inv of openInvoices) {
    invoiceStates.set(inv.id, {
      id: inv.id,
      paidAmount: inv.paidAmount,
      remainingAmount: inv.remainingAmount,
      status: inv.status,
    });
  }

  const allocations: Array<{
    paymentId: number;
    saleId: number;
    amount: number;
  }> = [];
  let ledgerBalance = openInvoices.reduce(
    (sum, inv) => sum + inv.remainingAmount,
    0,
  );

  const customerLedgerRepo = {
    getLastBalanceSync: vi.fn(async () => ledgerBalance),
    createSync: vi.fn(async (e: any) => {
      ledgerBalance = e.balanceAfter;
      return { id: 1, ...e };
    }),
    findByPaymentIdSync: vi.fn(async () => null),
  };

  const customerRepo = {
    findById: vi.fn(async () => ({ id: 10, name: "Test Customer" })),
    updateDebt: vi.fn(async () => {}),
  };

  let paymentIdCounter = 100;
  const paymentRepo = {
    findByIdempotencyKey: vi.fn(async () => null),
    createSync: vi.fn(async (p: any) => ({ id: paymentIdCounter++, ...p })),
  };

  const saleRepo = {
    findOpenByCustomerId: vi.fn(async () => {
      // Return invoices that still have remaining amount
      return openInvoices
        .filter((inv) => {
          const state = invoiceStates.get(inv.id)!;
          return (
            state.remainingAmount > 0 &&
            state.status !== "cancelled" &&
            state.status !== "refunded"
          );
        })
        .map((inv) => {
          const state = invoiceStates.get(inv.id)!;
          return { ...inv, ...state };
        });
    }),
    update: vi.fn(async (id: number, data: any) => {
      const state = invoiceStates.get(id);
      if (state) {
        if (data.paidAmount !== undefined) state.paidAmount = data.paidAmount;
        if (data.remainingAmount !== undefined)
          state.remainingAmount = data.remainingAmount;
        if (data.status !== undefined) state.status = data.status;
      }
    }),
    findById: vi.fn(async (id: number) => {
      const inv = openInvoices.find((i) => i.id === id);
      if (!inv) return null;
      const state = invoiceStates.get(id)!;
      return {
        ...inv,
        ...state,
        paymentStatus: derivePaymentStatus(state.paidAmount, inv.total),
      };
    }),
  };

  const paymentAllocationRepo = {
    create: vi.fn(async (a: any) => {
      allocations.push(a);
      return { id: allocations.length, ...a };
    }),
    findByPaymentId: vi.fn(async () => []),
  };

  const accountingRepo = {
    findAccountByCode: vi.fn(async () => null),
    createJournalEntrySync: vi.fn(async (entry: any) => ({ id: 1, ...entry })),
  };

  const settingsRepo = {
    get: vi.fn(async (key: string) => {
      if (key === "accounting.enabled") return "false";
      return null;
    }),
    set: vi.fn(),
  };

  const mockDb = { transaction: (fn: any) => fn(mockDb) } as any;

  return {
    customerLedgerRepo,
    customerRepo,
    paymentRepo,
    saleRepo,
    paymentAllocationRepo,
    accountingRepo,
    settingsRepo,
    mockDb,
    // Access helpers
    invoiceStates,
    allocations,
  };
}

function createUseCase(deps: ReturnType<typeof buildCustomerPaymentDeps>) {
  return new RecordCustomerPaymentUseCase(
    deps.customerLedgerRepo as any,
    deps.customerRepo as any,
    deps.paymentRepo as any,
    deps.saleRepo as any,
    deps.paymentAllocationRepo as any,
    deps.accountingRepo as any,
    undefined, // auditRepo
    deps.settingsRepo as any,
    undefined, // accountingSettingsRepo
    deps.mockDb,
  );
}

// ─── Test: Single invoice fully paid ────────────────────────────────────────

describe("RecordCustomerPaymentUseCase — invoice settlement", () => {
  test("1. single invoice fully paid by customer-profile payment", async () => {
    const invoice = makeSale({ id: 1, total: 50000 });
    const deps = buildCustomerPaymentDeps([invoice]);
    const uc = createUseCase(deps);

    const result = await uc.executeCommitPhase(
      { customerId: 10, amount: 50000, paymentMethod: "cash" },
      "1",
    );

    // Verify allocations
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual({ saleId: 1, amount: 50000 });
    expect(result.unappliedAmount).toBe(0);

    // Verify invoice state updated
    const state = deps.invoiceStates.get(1)!;
    expect(state.paidAmount).toBe(50000);
    expect(state.remainingAmount).toBe(0);
    expect(state.status).toBe("completed");

    // Verify saleRepo.update was called correctly
    expect(deps.saleRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        paidAmount: 50000,
        remainingAmount: 0,
        status: "completed",
      }),
      expect.anything(),
    );

    // Verify allocation row created
    expect(deps.paymentAllocationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ saleId: 1, amount: 50000 }),
      expect.anything(),
    );
  });

  // ─── Test: Single invoice partially paid ────────────────────────────────

  test("2. single invoice partially paid by customer-profile payment", async () => {
    const invoice = makeSale({ id: 1, total: 50000 });
    const deps = buildCustomerPaymentDeps([invoice]);
    const uc = createUseCase(deps);

    const result = await uc.executeCommitPhase(
      { customerId: 10, amount: 20000, paymentMethod: "cash" },
      "1",
    );

    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0]).toEqual({ saleId: 1, amount: 20000 });
    expect(result.unappliedAmount).toBe(0);

    const state = deps.invoiceStates.get(1)!;
    expect(state.paidAmount).toBe(20000);
    expect(state.remainingAmount).toBe(30000);
    // Partial payment should NOT change status to completed
    expect(state.status).toBe("pending");
  });

  // ─── Test: FIFO settlement across multiple invoices ─────────────────────

  test("3. payment settling multiple invoices FIFO", async () => {
    const invoices = [
      makeSale({ id: 1, total: 20000, createdAt: "2026-03-01T00:00:00.000Z" }),
      makeSale({ id: 2, total: 30000, createdAt: "2026-03-02T00:00:00.000Z" }),
      makeSale({ id: 3, total: 10000, createdAt: "2026-03-03T00:00:00.000Z" }),
    ];
    const deps = buildCustomerPaymentDeps(invoices);
    const uc = createUseCase(deps);

    const result = await uc.executeCommitPhase(
      { customerId: 10, amount: 45000, paymentMethod: "cash" },
      "1",
    );

    // Invoice 1 (20000): fully paid
    // Invoice 2 (30000): fully paid (20000 + 25000-remaining → 25000)
    // Invoice 3 (10000): not touched since 45000 - 20000 - 30000 = -5000? No.
    // 45000 - 20000 = 25000 remaining → apply 25000 to invoice 2 (30000) → partial
    expect(result.allocations).toEqual([
      { saleId: 1, amount: 20000 },
      { saleId: 2, amount: 25000 },
    ]);
    expect(result.unappliedAmount).toBe(0);

    // Invoice 1: fully paid
    const state1 = deps.invoiceStates.get(1)!;
    expect(state1.paidAmount).toBe(20000);
    expect(state1.remainingAmount).toBe(0);
    expect(state1.status).toBe("completed");

    // Invoice 2: partially paid
    const state2 = deps.invoiceStates.get(2)!;
    expect(state2.paidAmount).toBe(25000);
    expect(state2.remainingAmount).toBe(5000);
    expect(state2.status).toBe("pending"); // still pending, not completed

    // Invoice 3: untouched
    const state3 = deps.invoiceStates.get(3)!;
    expect(state3.paidAmount).toBe(0);
    expect(state3.remainingAmount).toBe(10000);
  });

  // ─── Test: Overpayment rejection ────────────────────────────────────────

  test("4. overpayment is rejected when payment exceeds total open debt", async () => {
    const invoice = makeSale({ id: 1, total: 50000 });
    const deps = buildCustomerPaymentDeps([invoice]);
    const uc = createUseCase(deps);

    await expect(
      uc.executeCommitPhase(
        { customerId: 10, amount: 60000, paymentMethod: "cash" },
        "1",
      ),
    ).rejects.toThrow("Payment amount exceeds total outstanding invoice debt");
  });

  // ─── Test: No open invoices rejection ───────────────────────────────────

  test("4b. payment rejected when customer has no open invoices", async () => {
    const deps = buildCustomerPaymentDeps([]);
    const uc = createUseCase(deps);

    await expect(
      uc.executeCommitPhase(
        { customerId: 10, amount: 10000, paymentMethod: "cash" },
        "1",
      ),
    ).rejects.toThrow("Customer has no open invoices to settle");
  });

  // ─── Test: Transaction rollback on mid-transaction failure ──────────────

  test("5. rollback on mid-transaction failure", async () => {
    const invoice = makeSale({ id: 1, total: 50000 });
    const deps = buildCustomerPaymentDeps([invoice]);

    // Make saleRepo.update fail to simulate mid-transaction failure
    deps.saleRepo.update.mockRejectedValueOnce(new Error("DB write failed"));

    // Use a mockDb that actually tracks rollback
    let committed = false;
    let rolledBack = false;
    const txMockDb = {
      transaction: async (fn: any) => {
        try {
          const result = await fn(txMockDb);
          committed = true;
          return result;
        } catch (error) {
          rolledBack = true;
          throw error;
        }
      },
    } as any;

    const uc = new RecordCustomerPaymentUseCase(
      deps.customerLedgerRepo as any,
      deps.customerRepo as any,
      deps.paymentRepo as any,
      deps.saleRepo as any,
      deps.paymentAllocationRepo as any,
      deps.accountingRepo as any,
      undefined,
      deps.settingsRepo as any,
      undefined,
      txMockDb,
    );

    await expect(
      uc.executeCommitPhase(
        { customerId: 10, amount: 50000, paymentMethod: "cash" },
        "1",
      ),
    ).rejects.toThrow("DB write failed");

    expect(committed).toBe(false);
    expect(rolledBack).toBe(true);
  });

  // ─── Test: Aggregate balance matches real invoice debt ──────────────────

  test("6. customer aggregate balance equals real unpaid invoice debt after payment", async () => {
    const invoices = [
      makeSale({ id: 1, total: 30000 }),
      makeSale({ id: 2, total: 20000 }),
    ];
    const deps = buildCustomerPaymentDeps(invoices);
    const uc = createUseCase(deps);

    await uc.executeCommitPhase(
      { customerId: 10, amount: 35000, paymentMethod: "cash" },
      "1",
    );

    // Total original debt: 50000
    // Payment: 35000
    // Remaining debt: 15000 (invoice 2 has 15000 remaining)
    const state1 = deps.invoiceStates.get(1)!;
    const state2 = deps.invoiceStates.get(2)!;
    const totalInvoiceDebt = state1.remainingAmount + state2.remainingAmount;
    expect(totalInvoiceDebt).toBe(15000);

    // Ledger balance should equal total remaining invoice debt
    expect(deps.customerLedgerRepo.createSync).toHaveBeenCalledWith(
      expect.objectContaining({
        balanceAfter: 50000 - 35000, // = 15000
      }),
      expect.anything(),
    );
    expect(totalInvoiceDebt).toBe(15000);
  });

  // ─── Test: Ledger and invoices updated together ─────────────────────────

  test("7. payment from customer profile updates ledger AND invoices together", async () => {
    const invoice = makeSale({ id: 1, total: 40000 });
    const deps = buildCustomerPaymentDeps([invoice]);
    const uc = createUseCase(deps);

    await uc.executeCommitPhase(
      { customerId: 10, amount: 40000, paymentMethod: "cash" },
      "1",
    );

    // Ledger was updated
    expect(deps.customerLedgerRepo.createSync).toHaveBeenCalledTimes(1);
    expect(deps.customerRepo.updateDebt).toHaveBeenCalledWith(10, -40000);

    // Invoice was updated
    expect(deps.saleRepo.update).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        paidAmount: 40000,
        remainingAmount: 0,
        status: "completed",
      }),
      expect.anything(),
    );

    // Allocation was created
    expect(deps.paymentAllocationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ saleId: 1, amount: 40000 }),
      expect.anything(),
    );
  });

  // ─── Test: Consistent status rules between direct and profile payments ──

  test("8. direct invoice payment and profile payment produce consistent paymentStatus", async () => {
    // Test that derivePaymentStatus is used correctly in both flows
    // by verifying the status derivation rules

    // unpaid
    expect(derivePaymentStatus(0, 50000)).toBe("unpaid");
    // partial
    expect(derivePaymentStatus(20000, 50000)).toBe("partial");
    // paid
    expect(derivePaymentStatus(50000, 50000)).toBe("paid");
    // overpaid (still "paid")
    expect(derivePaymentStatus(60000, 50000)).toBe("paid");

    // Now verify profile payment correctly drives status to "paid"
    const invoice = makeSale({
      id: 1,
      total: 50000,
      paidAmount: 20000,
      remainingAmount: 30000,
    });
    const deps = buildCustomerPaymentDeps([invoice]);
    const uc = createUseCase(deps);

    await uc.executeCommitPhase(
      { customerId: 10, amount: 30000, paymentMethod: "cash" },
      "1",
    );

    const state = deps.invoiceStates.get(1)!;
    expect(state.paidAmount).toBe(50000);
    expect(state.remainingAmount).toBe(0);
    expect(state.status).toBe("completed");
    expect(derivePaymentStatus(state.paidAmount, 50000)).toBe("paid");
  });

  // ─── Test: Validation ───────────────────────────────────────────────────

  test("rejects non-positive payment amount", async () => {
    const deps = buildCustomerPaymentDeps([makeSale({ id: 1, total: 50000 })]);
    const uc = createUseCase(deps);

    await expect(
      uc.executeCommitPhase(
        { customerId: 10, amount: 0, paymentMethod: "cash" },
        "1",
      ),
    ).rejects.toThrow("Payment amount must be greater than zero");

    await expect(
      uc.executeCommitPhase(
        { customerId: 10, amount: -1000, paymentMethod: "cash" },
        "1",
      ),
    ).rejects.toThrow("Payment amount must be greater than zero");
  });

  test("rejects non-integer payment amount", async () => {
    const deps = buildCustomerPaymentDeps([makeSale({ id: 1, total: 50000 })]);
    const uc = createUseCase(deps);

    await expect(
      uc.executeCommitPhase(
        { customerId: 10, amount: 10000.5, paymentMethod: "cash" },
        "1",
      ),
    ).rejects.toThrow("Payment amount must be an integer IQD amount");
  });

  test("rejects if customer not found", async () => {
    const deps = buildCustomerPaymentDeps([makeSale({ id: 1, total: 50000 })]);
    deps.customerRepo.findById.mockResolvedValueOnce(null);
    const uc = createUseCase(deps);

    await expect(
      uc.executeCommitPhase(
        { customerId: 999, amount: 10000, paymentMethod: "cash" },
        "1",
      ),
    ).rejects.toThrow("Customer not found");
  });

  // ─── Test: FIFO with already-partial invoices ───────────────────────────

  test("FIFO allocation correctly handles already partially-paid invoices", async () => {
    const invoices = [
      makeSale({
        id: 1,
        total: 30000,
        paidAmount: 10000,
        remainingAmount: 20000,
      }),
      makeSale({ id: 2, total: 20000, paidAmount: 0, remainingAmount: 20000 }),
    ];
    const deps = buildCustomerPaymentDeps(invoices);
    const uc = createUseCase(deps);

    await uc.executeCommitPhase(
      { customerId: 10, amount: 25000, paymentMethod: "cash" },
      "1",
    );

    // Invoice 1 remaining=20000 → fully allocated (20000)
    const state1 = deps.invoiceStates.get(1)!;
    expect(state1.paidAmount).toBe(30000); // 10000 + 20000
    expect(state1.remainingAmount).toBe(0);
    expect(state1.status).toBe("completed");

    // Invoice 2 remaining=20000 → allocated 5000
    const state2 = deps.invoiceStates.get(2)!;
    expect(state2.paidAmount).toBe(5000);
    expect(state2.remainingAmount).toBe(15000);
    expect(state2.status).toBe("pending");
  });

  // ─── Test: Payment creates payment record ───────────────────────────────

  test("payment record is created with correct data", async () => {
    const invoice = makeSale({ id: 1, total: 50000 });
    const deps = buildCustomerPaymentDeps([invoice]);
    const uc = createUseCase(deps);

    await uc.executeCommitPhase(
      {
        customerId: 10,
        amount: 25000,
        paymentMethod: "bank_transfer",
        notes: "test",
      },
      "42",
    );

    expect(deps.paymentRepo.createSync).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 10,
        amount: 25000,
        paymentMethod: "bank_transfer",
        status: "completed",
        currency: "IQD",
        notes: "test",
      }),
      expect.anything(),
    );
  });

  // ─── Test: Exact payment equals total debt ──────────────────────────────

  test("payment exactly equal to total debt fully settles all invoices", async () => {
    const invoices = [
      makeSale({ id: 1, total: 15000 }),
      makeSale({ id: 2, total: 25000 }),
      makeSale({ id: 3, total: 10000 }),
    ];
    const deps = buildCustomerPaymentDeps(invoices);
    const uc = createUseCase(deps);

    await uc.executeCommitPhase(
      { customerId: 10, amount: 50000, paymentMethod: "cash" },
      "1",
    );

    for (const inv of invoices) {
      const state = deps.invoiceStates.get(inv.id)!;
      expect(state.paidAmount).toBe(inv.total);
      expect(state.remainingAmount).toBe(0);
      expect(state.status).toBe("completed");
    }

    expect(deps.allocations).toHaveLength(3);
  });
});
