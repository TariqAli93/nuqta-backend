import { describe, expect, test, vi } from "vitest";
import { RefundSaleUseCase } from "../../../src/domain/use-cases/sales/RefundSaleUseCase.ts";
import { AccountingRepository } from "../../../src/data/repositories/accounting/AccountingRepository.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeMockDb() {
  return {
    // Simulate Drizzle's transaction() by calling the callback immediately
    // with the db itself as the "transaction client".
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({}),
    ),
  };
}

function makeSale(overrides: Record<string, unknown> = {}) {
  return {
    id: 11,
    invoiceNumber: "SAL-001",
    customerId: 3,
    paymentType: "cash",
    paidAmount: 20000,
    remainingAmount: 0,
    total: 20000,
    currency: "IQD",
    tax: 0,
    status: "completed",
    notes: null,
    items: [],
    ...overrides,
  };
}

/** Builds a minimal set of mock repos for RefundSaleUseCase. */
function makeRepos(
  saleOverrides: Record<string, unknown> = {},
  accountingOverrides: Record<string, unknown> = {},
) {
  const sale = makeSale(saleOverrides);

  const saleRepo = {
    findById: vi.fn(async () => sale),
    update: vi.fn(async () => {}),
    getItemDepletionsBySaleId: vi.fn(async () => []),
  };

  const paymentRepo = {
    createSync: vi.fn(async () => ({
      id: 1,
      amount: -Number(saleOverrides.paidAmount ?? 20000),
      status: "refunded",
    })),
  };

  const inventoryRepo = {};

  const accountingRepo = {
    findAccountByCode: vi.fn(async (code: string) => {
      // Matches DEFAULT_ACCOUNTING_CODES in InitializeAccountingUseCase
      const chart: Record<string, { id: number }> = {
        "1001": { id: 1 }, // Cash
        "1100": { id: 2 }, // AR
        "4001": { id: 3 }, // Revenue
        "5001": { id: 4 }, // COGS
        "1200": { id: 5 }, // Inventory
        "2200": { id: 6 }, // VAT Output
      };
      return chart[code] ?? null;
    }),
    createCreditNoteEntry: vi.fn(async () => ({ id: 1, lines: [] })),
    ...accountingOverrides,
  };

  const customerLedgerRepo = {
    getLastBalanceSync: vi.fn(async () => 0),
    createSync: vi.fn(async () => {}),
  };

  // Settings: accounting and ledgers enabled, correct account codes.
  const settingsRepo = {
    get: vi.fn(async (key: string) => {
      const settings: Record<string, string> = {
        "accounting.cashAccountCode": "1001",
        "accounting.arAccountCode": "1100",
        "accounting.salesRevenueAccountCode": "4001",
        "accounting.cogsAccountCode": "5001",
        "accounting.inventoryAccountCode": "1200",
        "accounting.vatOutputAccountCode": "2200",
      };
      return settings[key] ?? null; // null → accounting/ledgers enabled by default
    }),
  };

  return {
    sale,
    saleRepo,
    paymentRepo,
    inventoryRepo,
    accountingRepo,
    customerLedgerRepo,
    settingsRepo,
  };
}

function makeUseCase(repos: ReturnType<typeof makeRepos>) {
  return new RefundSaleUseCase(
    makeMockDb() as any,
    repos.saleRepo as any,
    repos.paymentRepo as any,
    repos.inventoryRepo as any,
    repos.accountingRepo as any,
    repos.customerLedgerRepo as any,
    repos.settingsRepo as any,
  );
}

// ---------------------------------------------------------------------------
// RefundSaleUseCase — accounting line resolution
// ---------------------------------------------------------------------------

describe("RefundSaleUseCase — accounting line resolution", () => {
  test("cash sale refund passes revenueAccountId and cashAccountId (no arAccountId)", async () => {
    const repos = makeRepos({ paymentType: "cash" });
    await makeUseCase(repos).execute({ saleId: 11, amount: 20000 }, "1");

    expect(repos.accountingRepo.createCreditNoteEntry).toHaveBeenCalledOnce();
    const params = repos.accountingRepo.createCreditNoteEntry.mock.calls[0][0];

    expect(params.revenueAccountId).toBe(3); // account id for "4001"
    expect(params.cashAccountId).toBe(1);    // account id for "1001"
    expect(params.arAccountId).toBeUndefined();
    expect(params.currency).toBe("IQD");
    expect(params.amount).toBe(20000);
  });

  test("credit sale refund passes revenueAccountId and arAccountId (no cashAccountId)", async () => {
    const repos = makeRepos({ paymentType: "credit" });
    await makeUseCase(repos).execute({ saleId: 11, amount: 20000 }, "1");

    const params = repos.accountingRepo.createCreditNoteEntry.mock.calls[0][0];

    expect(params.revenueAccountId).toBe(3); // account id for "4001"
    expect(params.arAccountId).toBe(2);      // account id for "1100"
    expect(params.cashAccountId).toBeUndefined();
  });

  test("mixed sale refund credits cash (not AR)", async () => {
    const repos = makeRepos({ paymentType: "mixed" });
    await makeUseCase(repos).execute({ saleId: 11, amount: 10000 }, "1");

    const params = repos.accountingRepo.createCreditNoteEntry.mock.calls[0][0];

    expect(params.cashAccountId).toBe(1);
    expect(params.arAccountId).toBeUndefined();
    expect(params.amount).toBe(10000);
  });

  test("sale currency is forwarded to the journal entry", async () => {
    const repos = makeRepos({ currency: "USD" });
    await makeUseCase(repos).execute({ saleId: 11, amount: 20000 }, "1");

    const params = repos.accountingRepo.createCreditNoteEntry.mock.calls[0][0];
    expect(params.currency).toBe("USD");
  });

  test("does not post journal entry when accounting is disabled", async () => {
    const repos = makeRepos();
    // Override settings to return "false" for accounting.enabled
    repos.settingsRepo.get = vi.fn(async (key: string) => {
      if (key === "accounting.enabled") return "false";
      return null;
    });

    await makeUseCase(repos).execute({ saleId: 11, amount: 20000 }, "1");

    expect(repos.accountingRepo.createCreditNoteEntry).not.toHaveBeenCalled();
  });

  test("falls back to AR when cash account is not in chart of accounts", async () => {
    const repos = makeRepos({ paymentType: "cash" });
    // Remove cash account from chart
    repos.accountingRepo.findAccountByCode = vi.fn(async (code: string) => {
      if (code === "1001") return null; // cash not configured
      if (code === "1100") return { id: 2 }; // AR exists
      if (code === "4001") return { id: 3 }; // Revenue
      return null;
    });

    await makeUseCase(repos).execute({ saleId: 11, amount: 20000 }, "1");

    const params = repos.accountingRepo.createCreditNoteEntry.mock.calls[0][0];
    // cashAccountId is undefined (not found), arAccountId should be set as fallback
    expect(params.cashAccountId).toBeUndefined();
    expect(params.arAccountId).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// RefundSaleUseCase — invoice status side effects
// ---------------------------------------------------------------------------

describe("RefundSaleUseCase — invoice status", () => {
  test("full refund sets sale status to 'refunded'", async () => {
    const repos = makeRepos({ paidAmount: 20000, total: 20000 });
    await makeUseCase(repos).execute({ saleId: 11, amount: 20000 }, "1");

    expect(repos.saleRepo.update).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ status: "refunded", paidAmount: 0 }),
      expect.anything(),
    );
  });

  test("partial refund sets sale status to 'partial_refund'", async () => {
    const repos = makeRepos({ paidAmount: 20000, total: 20000 });
    const result = await makeUseCase(repos).execute(
      { saleId: 11, amount: 10000 },
      "1",
    );

    expect(result.refundedAmount).toBe(10000);
    expect(result.newPaidAmount).toBe(10000);
    expect(result.newRemainingAmount).toBe(10000);

    expect(repos.saleRepo.update).toHaveBeenCalledWith(
      11,
      expect.objectContaining({ status: "partial_refund", paidAmount: 10000 }),
      expect.anything(),
    );
  });
});

// ---------------------------------------------------------------------------
// RefundSaleUseCase — domain validation guards
// ---------------------------------------------------------------------------

describe("RefundSaleUseCase — domain validation", () => {
  test("throws NOT_FOUND when sale does not exist", async () => {
    const repos = makeRepos();
    repos.saleRepo.findById = vi.fn(async () => null);

    await expect(
      makeUseCase(repos).execute({ saleId: 999, amount: 10000 }, "1"),
    ).rejects.toThrow("الفاتورة غير موجودة");
  });

  test("throws INVALID_STATE when sale is cancelled", async () => {
    const repos = makeRepos({ status: "cancelled" });

    await expect(
      makeUseCase(repos).execute({ saleId: 11, amount: 10000 }, "1"),
    ).rejects.toThrow("لا يمكن استرداد فاتورة ملغية");
  });

  test("throws INVALID_STATE when sale is already fully refunded", async () => {
    const repos = makeRepos({ status: "refunded" });

    await expect(
      makeUseCase(repos).execute({ saleId: 11, amount: 10000 }, "1"),
    ).rejects.toThrow("تم استرداد هذه الفاتورة بالكامل بالفعل");
  });

  test("throws VALIDATION_ERROR when refund amount is zero", async () => {
    const repos = makeRepos();

    await expect(
      makeUseCase(repos).execute({ saleId: 11, amount: 0 }, "1"),
    ).rejects.toThrow("مبلغ الاسترداد يجب أن يكون أكبر من صفر");
  });

  test("throws INVALID_STATE when nothing has been paid", async () => {
    const repos = makeRepos({ paidAmount: 0 });

    await expect(
      makeUseCase(repos).execute({ saleId: 11, amount: 5000 }, "1"),
    ).rejects.toThrow("لا يوجد مبلغ مدفوع لاسترداده");
  });

  test("throws VALIDATION_ERROR when refund amount exceeds paidAmount", async () => {
    const repos = makeRepos({ paidAmount: 5000 });

    await expect(
      makeUseCase(repos).execute({ saleId: 11, amount: 10000 }, "1"),
    ).rejects.toThrow("مبلغ الاسترداد أكبر من المبلغ المدفوع");
  });
});

// ---------------------------------------------------------------------------
// AccountingRepository.createCreditNoteEntry — balanced-entry guard
// ---------------------------------------------------------------------------

describe("AccountingRepository.createCreditNoteEntry — balanced-entry guard", () => {
  /**
   * Build a minimal AccountingRepository stub so we can test the balance
   * validation logic without a real database.  We spy on findAccountByCode()
   * and stub out insertJournalEntry (now protected) to avoid hitting the DB.
   */
  function makeAccountingRepo(
    accountMap: Record<string, number | null>,
  ): AccountingRepository {
    const repo = new AccountingRepository({} as any);

    // findAccountByCode is a public method on AccountingRepository — no cast needed.
    vi.spyOn(repo, "findAccountByCode").mockImplementation(
      async (code: string) => {
        const id = accountMap[code];
        return id != null ? ({ id } as any) : null;
      },
    );

    // insertJournalEntry is protected so we cast to reach it in tests.
    vi.spyOn(repo as any, "insertJournalEntry").mockResolvedValue({
      id: 1,
      lines: [],
    } as any);

    return repo;
  }

  test("persists when entry is balanced (revenue + cash)", async () => {
    const repo = makeAccountingRepo({
      "4001": 3, // Revenue
      "1001": 1, // Cash
    });

    await expect(
      repo.createCreditNoteEntry({
        saleId: 11,
        amount: 20000,
        description: "Test refund",
        createdBy: 1,
        revenueAccountId: 3,
        cashAccountId: 1,
      }),
    ).resolves.toBeDefined();
  });

  test("throws when revenue account is missing (no debit side)", async () => {
    const repo = makeAccountingRepo({
      "4001": null, // Revenue MISSING
      "1001": 1,    // Cash present
    });

    await expect(
      repo.createCreditNoteEntry({
        saleId: 11,
        amount: 20000,
        description: "Test refund",
        createdBy: 1,
        // revenueAccountId not passed → falls back to findAccountByCode("4001") → null
        cashAccountId: 1,
      }),
    ).rejects.toThrow(/Cannot persist unbalanced credit note entry/);
  });

  test("throws when counter-account (cash+AR) is missing (no credit side)", async () => {
    const repo = makeAccountingRepo({
      "4001": 3, // Revenue present
      "1001": null, // Cash MISSING
      "1100": null, // AR MISSING
    });

    await expect(
      repo.createCreditNoteEntry({
        saleId: 11,
        amount: 20000,
        description: "Test refund",
        createdBy: 1,
        revenueAccountId: 3,
        // cashAccountId / arAccountId not passed → both fallback lookups return null
      }),
    ).rejects.toThrow(/Cannot persist unbalanced credit note entry/);
  });

  test("throws when both revenue and counter-account are missing (zero lines)", async () => {
    const repo = makeAccountingRepo({});

    await expect(
      repo.createCreditNoteEntry({
        saleId: 11,
        amount: 20000,
        description: "Test refund",
        createdBy: 1,
      }),
    ).rejects.toThrow(/Cannot persist unbalanced credit note entry/);
  });

  test("is balanced when COGS reversal is included with inventory account", async () => {
    const repo = makeAccountingRepo({
      "4001": 3,
      "1001": 1,
      "5001": 4,
      "1200": 5,
    });

    await expect(
      repo.createCreditNoteEntry({
        saleId: 11,
        amount: 20000,
        cogsReversal: 14000,
        description: "Test refund with goods returned",
        createdBy: 1,
        revenueAccountId: 3,
        cashAccountId: 1,
        cogsAccountId: 4,
        inventoryAccountId: 5,
      }),
    ).resolves.toBeDefined();
  });

  test("COGS reversal with missing inventory account is still balanced (COGS lines excluded)", async () => {
    // When only the COGS account exists but not inventory, both COGS lines are omitted
    // because an incomplete COGS reversal would itself be unbalanced.
    // The revenue + cash lines remain balanced on their own.
    const repo = makeAccountingRepo({
      "4001": 3,
      "1001": 1,
      "5001": null, // COGS MISSING → neither COGS line is added
      "1200": null, // Inventory MISSING
    });

    await expect(
      repo.createCreditNoteEntry({
        saleId: 11,
        amount: 20000,
        cogsReversal: 14000,
        description: "Test refund",
        createdBy: 1,
        revenueAccountId: 3,
        cashAccountId: 1,
      }),
    ).resolves.toBeDefined();
  });
});
