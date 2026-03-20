import { describe, expect, test, vi } from "vitest";
import { SettingsAccessor } from "../../../src/domain/shared/services/SettingsAccessor.ts";
import { AddPaymentUseCase } from "../../../src/domain/use-cases/sales/AddPaymentUseCase.ts";
import { AddPurchasePaymentUseCase } from "../../../src/domain/use-cases/purchases/AddPurchasePaymentUseCase.ts";
import { RecordCustomerPaymentUseCase } from "../../../src/domain/use-cases/customer-ledger/RecordCustomerPaymentUseCase.ts";
import { RecordSupplierPaymentUseCase } from "../../../src/domain/use-cases/supplier-ledger/RecordSupplierPaymentUseCase.ts";

// ─── SettingsAccessor.isAutoPostingEnabled ─────────────────────

describe("SettingsAccessor.isAutoPostingEnabled", () => {
  test("returns true when accountingSettingsRepo reports autoPosting = true", async () => {
    const settingsRepo = { get: vi.fn(async () => null), set: vi.fn() };
    const accountingSettingsRepo = {
      get: vi.fn(async () => ({ autoPosting: true })),
      update: vi.fn(),
    };
    const accessor = new SettingsAccessor(
      settingsRepo as any,
      accountingSettingsRepo as any,
    );
    expect(await accessor.isAutoPostingEnabled()).toBe(true);
  });

  test("returns false when accountingSettingsRepo reports autoPosting = false", async () => {
    const settingsRepo = { get: vi.fn(async () => null), set: vi.fn() };
    const accountingSettingsRepo = {
      get: vi.fn(async () => ({ autoPosting: false })),
      update: vi.fn(),
    };
    const accessor = new SettingsAccessor(
      settingsRepo as any,
      accountingSettingsRepo as any,
    );
    expect(await accessor.isAutoPostingEnabled()).toBe(false);
  });

  test("returns false when accountingSettingsRepo throws", async () => {
    const settingsRepo = { get: vi.fn(async () => null), set: vi.fn() };
    const accountingSettingsRepo = {
      get: vi.fn(async () => {
        throw new Error("db error");
      }),
      update: vi.fn(),
    };
    const accessor = new SettingsAccessor(
      settingsRepo as any,
      accountingSettingsRepo as any,
    );
    expect(await accessor.isAutoPostingEnabled()).toBe(false);
  });

  test("falls back to flat KV store when accountingSettingsRepo is not provided", async () => {
    const settingsRepo = {
      get: vi.fn(async (key: string) =>
        key === "accounting.autoPosting" ? "true" : null,
      ),
      set: vi.fn(),
    };
    const accessor = new SettingsAccessor(settingsRepo as any);
    expect(await accessor.isAutoPostingEnabled()).toBe(true);
  });

  test("returns false when flat KV store has no autoPosting key and no accountingSettingsRepo", async () => {
    const settingsRepo = { get: vi.fn(async () => null), set: vi.fn() };
    const accessor = new SettingsAccessor(settingsRepo as any);
    expect(await accessor.isAutoPostingEnabled()).toBe(false);
  });
});

// ─── AddPaymentUseCase auto-posting integration ───────────────

describe("AddPaymentUseCase auto-posting", () => {
  function buildDeps(autoPosting: boolean) {
    const sale = {
      id: 1,
      invoiceNumber: "INV-001",
      total: 50000,
      paidAmount: 0,
      remainingAmount: 50000,
      customerId: 10,
      status: "pending",
      currency: "IQD",
      exchangeRate: 1,
    };
    const saleRepo = {
      findById: vi.fn(async () => sale),
      update: vi.fn(async () => {}),
    };
    const paymentRepo = {
      findByIdempotencyKey: vi.fn(async () => null),
      createSync: vi.fn(async (p: any) => ({ id: 42, ...p })),
    };
    const customerRepo = {
      updateDebt: vi.fn(async () => {}),
    };
    const customerLedgerRepo = {
      getLastBalanceSync: vi.fn(async () => 0),
      createSync: vi.fn(async (e: any) => ({ id: 1, ...e })),
    };
    const accountingRepo = {
      findAccountByCode: vi.fn(async (code: string) => {
        if (code === "1001") return { id: 101, code: "1001" };
        if (code === "1100") return { id: 110, code: "1100" };
        return null;
      }),
      createJournalEntrySync: vi.fn(async (entry: any) => ({
        id: 81,
        ...entry,
      })),
    };
    const settingsRepo = {
      get: vi.fn(async (key: string) => {
        if (key === "accounting.enabled") return "true";
        if (key === "ledgers.enabled") return "true";
        return null;
      }),
      set: vi.fn(),
    };
    const accountingSettingsRepo = {
      get: vi.fn(async () => ({ autoPosting })),
      update: vi.fn(),
    };
    const db = {
      transaction: async (fn: (tx: unknown) => unknown) => fn({}),
    };
    return {
      db,
      saleRepo,
      paymentRepo,
      customerRepo,
      customerLedgerRepo,
      accountingRepo,
      settingsRepo,
      accountingSettingsRepo,
    };
  }

  test("creates journal entry with isPosted=true when autoPosting is enabled", async () => {
    const deps = buildDeps(true);
    const uc = new AddPaymentUseCase(
      deps.db as any,
      deps.saleRepo as any,
      deps.paymentRepo as any,
      deps.customerRepo as any,
      deps.customerLedgerRepo as any,
      deps.accountingRepo as any,
      deps.settingsRepo as any,
      undefined, // auditRepo
      deps.accountingSettingsRepo as any,
    );

    await uc.executeCommitPhase(
      {
        saleId: 1,
        amount: 25000,
        paymentMethod: "cash",
      },
      1,
    );

    expect(deps.accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({ isPosted: true }),
      expect.anything(),
    );
  });

  test("creates journal entry with isPosted=false when autoPosting is disabled", async () => {
    const deps = buildDeps(false);
    const uc = new AddPaymentUseCase(
      deps.db as any,
      deps.saleRepo as any,
      deps.paymentRepo as any,
      deps.customerRepo as any,
      deps.customerLedgerRepo as any,
      deps.accountingRepo as any,
      deps.settingsRepo as any,
      undefined,
      deps.accountingSettingsRepo as any,
    );

    await uc.executeCommitPhase(
      {
        saleId: 1,
        amount: 25000,
        paymentMethod: "cash",
      },
      1,
    );

    expect(deps.accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({ isPosted: false }),
      expect.anything(),
    );
  });
});

// ─── AddPurchasePaymentUseCase auto-posting integration ───────

describe("AddPurchasePaymentUseCase auto-posting", () => {
  function buildDeps(autoPosting: boolean) {
    const purchase = {
      id: 2,
      invoiceNumber: "PUR-001",
      total: 80000,
      paidAmount: 0,
      remainingAmount: 80000,
      supplierId: 5,
      status: "pending",
      currency: "IQD",
      exchangeRate: 1,
    };
    const purchaseRepo = {
      findByIdSync: vi.fn(async () => purchase),
      updatePaymentSync: vi.fn(async () => {}),
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
      findAccountByCode: vi.fn(async (code: string) => {
        if (code === "1001") return { id: 101, code: "1001" };
        if (code === "2100") return { id: 210, code: "2100" };
        return null;
      }),
      createJournalEntrySync: vi.fn(async (entry: any) => ({
        id: 82,
        ...entry,
      })),
    };
    const settingsRepo = {
      get: vi.fn(async (key: string) => {
        if (key === "accounting.enabled") return "true";
        if (key === "ledgers.enabled") return "true";
        return null;
      }),
      set: vi.fn(),
    };
    const accountingSettingsRepo = {
      get: vi.fn(async () => ({ autoPosting })),
      update: vi.fn(),
    };
    return {
      purchaseRepo,
      paymentRepo,
      supplierLedgerRepo,
      accountingRepo,
      settingsRepo,
      accountingSettingsRepo,
    };
  }

  test("creates journal entry with isPosted=true when autoPosting is enabled", async () => {
    const deps = buildDeps(true);
    const uc = new AddPurchasePaymentUseCase(
      deps.purchaseRepo as any,
      deps.paymentRepo as any,
      deps.supplierLedgerRepo as any,
      deps.accountingRepo as any,
      deps.settingsRepo as any,
      undefined, // auditRepo
      deps.accountingSettingsRepo as any,
    );

    await uc.executeCommitPhase(
      {
        purchaseId: 2,
        amount: 40000,
        paymentMethod: "cash",
      },
      1,
    );

    expect(deps.accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({ isPosted: true }),
    );
  });

  test("creates journal entry with isPosted=false when autoPosting is disabled", async () => {
    const deps = buildDeps(false);
    const uc = new AddPurchasePaymentUseCase(
      deps.purchaseRepo as any,
      deps.paymentRepo as any,
      deps.supplierLedgerRepo as any,
      deps.accountingRepo as any,
      deps.settingsRepo as any,
      undefined,
      deps.accountingSettingsRepo as any,
    );

    await uc.executeCommitPhase(
      {
        purchaseId: 2,
        amount: 40000,
        paymentMethod: "cash",
      },
      1,
    );

    expect(deps.accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({ isPosted: false }),
    );
  });
});

// ─── RecordCustomerPaymentUseCase auto-posting ────────────────

describe("RecordCustomerPaymentUseCase auto-posting", () => {
  function buildDeps(autoPosting: boolean) {
    const customerLedgerRepo = {
      getLastBalanceSync: vi.fn(async () => 50000),
      createSync: vi.fn(async (e: any) => ({ id: 1, ...e })),
      findByPaymentIdSync: vi.fn(async () => null),
    };
    const customerRepo = {
      findById: vi.fn(async () => ({ id: 10, name: "Test" })),
      updateDebt: vi.fn(async () => {}),
    };
    const paymentRepo = {
      findByIdempotencyKey: vi.fn(async () => null),
      createSync: vi.fn(async (p: any) => ({ id: 66, ...p })),
    };
    const accountingRepo = {
      findAccountByCode: vi.fn(async (code: string) => {
        if (code === "1001") return { id: 101, code: "1001" };
        if (code === "1100") return { id: 110, code: "1100" };
        return null;
      }),
      createJournalEntrySync: vi.fn(async (entry: any) => ({
        id: 83,
        ...entry,
      })),
    };
    const settingsRepo = {
      get: vi.fn(async (key: string) => {
        if (key === "accounting.enabled") return "true";
        return null;
      }),
      set: vi.fn(),
    };
    const accountingSettingsRepo = {
      get: vi.fn(async () => ({ autoPosting })),
      update: vi.fn(),
    };
    return {
      customerLedgerRepo,
      customerRepo,
      paymentRepo,
      accountingRepo,
      settingsRepo,
      accountingSettingsRepo,
    };
  }

  test("creates journal entry with isPosted=true when autoPosting is enabled", async () => {
    const deps = buildDeps(true);
    const uc = new RecordCustomerPaymentUseCase(
      deps.customerLedgerRepo as any,
      deps.customerRepo as any,
      deps.paymentRepo as any,
      deps.accountingRepo as any,
      undefined, // auditRepo
      deps.settingsRepo as any,
      deps.accountingSettingsRepo as any,
    );

    await uc.executeCommitPhase(
      { customerId: 10, amount: 10000, paymentMethod: "cash" },
      1,
    );

    expect(deps.accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({ isPosted: true }),
    );
  });

  test("creates journal entry with isPosted=false when autoPosting is disabled", async () => {
    const deps = buildDeps(false);
    const uc = new RecordCustomerPaymentUseCase(
      deps.customerLedgerRepo as any,
      deps.customerRepo as any,
      deps.paymentRepo as any,
      deps.accountingRepo as any,
      undefined,
      deps.settingsRepo as any,
      deps.accountingSettingsRepo as any,
    );

    await uc.executeCommitPhase(
      { customerId: 10, amount: 10000, paymentMethod: "cash" },
      1,
    );

    expect(deps.accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({ isPosted: false }),
    );
  });
});

// ─── RecordSupplierPaymentUseCase auto-posting ────────────────

describe("RecordSupplierPaymentUseCase auto-posting", () => {
  function buildDeps(autoPosting: boolean) {
    const supplierLedgerRepo = {
      getLastBalanceSync: vi.fn(async () => 60000),
      createSync: vi.fn(async (e: any) => ({ id: 1, ...e })),
      findByPaymentIdSync: vi.fn(async () => null),
    };
    const supplierRepo = {
      findByIdSync: vi.fn(async () => ({ id: 5, name: "Supplier X" })),
      updatePayable: vi.fn(async () => {}),
    };
    const paymentRepo = {
      findByIdempotencyKey: vi.fn(async () => null),
      createSync: vi.fn(async (p: any) => ({ id: 77, ...p })),
    };
    const accountingRepo = {
      findAccountByCode: vi.fn(async (code: string) => {
        if (code === "1001") return { id: 101, code: "1001" };
        if (code === "2100") return { id: 210, code: "2100" };
        return null;
      }),
      createJournalEntrySync: vi.fn(async (entry: any) => ({
        id: 84,
        ...entry,
      })),
    };
    const settingsRepo = {
      get: vi.fn(async (key: string) => {
        if (key === "accounting.enabled") return "true";
        return null;
      }),
      set: vi.fn(),
    };
    const accountingSettingsRepo = {
      get: vi.fn(async () => ({ autoPosting })),
      update: vi.fn(),
    };
    return {
      supplierLedgerRepo,
      supplierRepo,
      paymentRepo,
      accountingRepo,
      settingsRepo,
      accountingSettingsRepo,
    };
  }

  test("creates journal entry with isPosted=true when autoPosting is enabled", async () => {
    const deps = buildDeps(true);
    const uc = new RecordSupplierPaymentUseCase(
      deps.supplierLedgerRepo as any,
      deps.supplierRepo as any,
      deps.paymentRepo as any,
      deps.accountingRepo as any,
      undefined, // auditRepo
      deps.settingsRepo as any,
      deps.accountingSettingsRepo as any,
    );

    await uc.executeCommitPhase(
      { supplierId: 5, amount: 20000, paymentMethod: "cash" },
      1,
    );

    expect(deps.accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({ isPosted: true }),
    );
  });

  test("creates journal entry with isPosted=false when autoPosting is disabled", async () => {
    const deps = buildDeps(false);
    const uc = new RecordSupplierPaymentUseCase(
      deps.supplierLedgerRepo as any,
      deps.supplierRepo as any,
      deps.paymentRepo as any,
      deps.accountingRepo as any,
      undefined,
      deps.settingsRepo as any,
      deps.accountingSettingsRepo as any,
    );

    await uc.executeCommitPhase(
      { supplierId: 5, amount: 20000, paymentMethod: "cash" },
      1,
    );

    expect(deps.accountingRepo.createJournalEntrySync).toHaveBeenCalledWith(
      expect.objectContaining({ isPosted: false }),
    );
  });
});
