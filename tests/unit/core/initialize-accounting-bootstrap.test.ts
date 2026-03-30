/**
 * First-Run Accounting Bootstrap Tests
 *
 * Validates the InitializeAccountingUseCase behaviour for every scenario
 * described in the first-run bootstrap specification.
 */
import { describe, expect, test, vi, beforeEach } from "vitest";
import {
  InitializeAccountingUseCase,
  ACCOUNTING_SETTING_KEYS,
  DEFAULT_ACCOUNTING_CODES,
  PARENT_ACCOUNT_BLUEPRINTS,
} from "../../../src/domain/use-cases/accounting/InitializeAccountingUseCase.js";
import type { Account } from "../../../src/domain/entities/Accounting.js";

// ── Mock factories ─────────────────────────────────────────────────────────

function makeSettingsRepo(overrides: Record<string, string | null> = {}) {
  const store = new Map<string, string>(
    Object.entries(overrides).filter(
      (entry): entry is [string, string] => entry[1] !== null,
    ),
  );

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    set: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    getAll: vi.fn(async () => Object.fromEntries(store)),
    getCurrencySettings: vi.fn(),
    getCompanySettings: vi.fn(),
    setCompanySettings: vi.fn(),
    // expose internal store for assertions
    _store: store,
  };
}

let nextId = 1;

function makeAccountingRepo(existingAccounts: Account[] = []) {
  const accounts = new Map<string, Account>(
    existingAccounts.map((a) => [a.code, a]),
  );

  return {
    findAccountByCode: vi.fn(async (code: string) => accounts.get(code) ?? null),
    findAccountById: vi.fn(async (id: number) => {
      for (const a of accounts.values()) {
        if (a.id === id) return a;
      }
      return null;
    }),
    createAccountSync: vi.fn(async (data: Omit<Account, "id" | "createdAt">) => {
      const account: Account = { ...data, id: nextId++ };
      accounts.set(account.code, account);
      return account;
    }),
    // expose internal map for assertions
    _accounts: accounts,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** All default leaf account codes that must be created on first run. */
const ALL_DEFAULT_LEAF_CODES = Object.values(DEFAULT_ACCOUNTING_CODES);
/** All parent account codes. */
const ALL_PARENT_CODES = PARENT_ACCOUNT_BLUEPRINTS.map((p) => p.code);

beforeEach(() => {
  nextId = 1;
});

// ── Suite 1: First startup — empty database ────────────────────────────────

describe("first startup with empty database", () => {
  test("creates all parent accounts before any leaf account", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    // All parent codes must be in createdCodes
    for (const code of ALL_PARENT_CODES) {
      expect(result.createdCodes).toContain(code);
    }

    // All leaf codes must be in createdCodes
    for (const code of ALL_DEFAULT_LEAF_CODES) {
      expect(result.createdCodes).toContain(code);
    }
  });

  test("each leaf account is linked to the correct parent via parentId", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    const allAccounts = Array.from(accountingRepo._accounts.values());

    // Helper: find account by code
    const byCode = (code: string) => allAccounts.find((a) => a.code === code);

    // Cash (1001) → parent Assets (1000)
    const assets = byCode("1000");
    const cash = byCode(DEFAULT_ACCOUNTING_CODES.cashAccountCode);
    expect(assets?.id).toBeDefined();
    expect(cash?.parentId).toBe(assets?.id);

    // Accounts Receivable (1100) → Assets
    expect(byCode(DEFAULT_ACCOUNTING_CODES.arAccountCode)?.parentId).toBe(
      assets?.id,
    );

    // Accounts Payable (2100) → Liabilities (2000)
    const liabilities = byCode("2000");
    expect(byCode(DEFAULT_ACCOUNTING_CODES.apAccountCode)?.parentId).toBe(
      liabilities?.id,
    );

    // VAT Output (2200) → Liabilities
    expect(byCode(DEFAULT_ACCOUNTING_CODES.vatOutputAccountCode)?.parentId).toBe(
      liabilities?.id,
    );

    // Sales Revenue (4001) → Revenue (4000)
    const revenue = byCode("4000");
    expect(
      byCode(DEFAULT_ACCOUNTING_CODES.salesRevenueAccountCode)?.parentId,
    ).toBe(revenue?.id);

    // COGS (5001) → Expenses (5000)
    const expenses = byCode("5000");
    expect(byCode(DEFAULT_ACCOUNTING_CODES.cogsAccountCode)?.parentId).toBe(
      expenses?.id,
    );

    // Salary Expense (5002) → Expenses
    expect(
      byCode(DEFAULT_ACCOUNTING_CODES.salaryExpenseAccountCode)?.parentId,
    ).toBe(expenses?.id);
  });

  test("sets coaSeeded = true when all accounts were created", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    expect(result.seeded).toBe(true);
    expect(result.missingCodes).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
    expect(settingsRepo._store.get(ACCOUNTING_SETTING_KEYS.coaSeeded)).toBe(
      "true",
    );
  });

  test("persists all default account codes in settings", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    expect(settingsRepo._store.get(ACCOUNTING_SETTING_KEYS.cashAccountCode)).toBe(
      DEFAULT_ACCOUNTING_CODES.cashAccountCode,
    );
    expect(
      settingsRepo._store.get(ACCOUNTING_SETTING_KEYS.arAccountCode),
    ).toBe(DEFAULT_ACCOUNTING_CODES.arAccountCode);
    expect(
      settingsRepo._store.get(ACCOUNTING_SETTING_KEYS.apAccountCode),
    ).toBe(DEFAULT_ACCOUNTING_CODES.apAccountCode);
    expect(
      settingsRepo._store.get(ACCOUNTING_SETTING_KEYS.salesRevenueAccountCode),
    ).toBe(DEFAULT_ACCOUNTING_CODES.salesRevenueAccountCode);
    expect(
      settingsRepo._store.get(ACCOUNTING_SETTING_KEYS.cogsAccountCode),
    ).toBe(DEFAULT_ACCOUNTING_CODES.cogsAccountCode);
  });
});

// ── Suite 2: Idempotency — re-run when everything already exists ───────────

describe("rerun startup when all accounts already exist", () => {
  function buildFullAccountSet(): Account[] {
    const accounts: Account[] = [];
    let id = 100;

    // Parents
    for (const p of PARENT_ACCOUNT_BLUEPRINTS) {
      accounts.push({
        id: id++,
        code: p.code,
        name: p.name,
        nameAr: p.nameAr,
        accountType: p.accountType,
        parentId: null,
        isSystem: true,
        isActive: true,
        balance: 0,
      });
    }

    // Leaves (parentId is not checked for idempotency — only code lookup matters)
    for (const code of ALL_DEFAULT_LEAF_CODES) {
      accounts.push({
        id: id++,
        code,
        name: `Account ${code}`,
        nameAr: `حساب ${code}`,
        accountType: "asset",
        parentId: 100,
        isSystem: true,
        isActive: true,
        balance: 0,
      });
    }

    return accounts;
  }

  test("does not call createAccountSync for any account", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
      [ACCOUNTING_SETTING_KEYS.coaSeeded]: "true",
    });
    const accountingRepo = makeAccountingRepo(buildFullAccountSet());
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    expect(accountingRepo.createAccountSync).not.toHaveBeenCalled();
  });

  test("all codes appear in existingCodes, none in createdCodes", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo(buildFullAccountSet());
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    expect(result.createdCodes).toHaveLength(0);
    for (const code of [...ALL_PARENT_CODES, ...ALL_DEFAULT_LEAF_CODES]) {
      expect(result.existingCodes).toContain(code);
    }
  });

  test("still sets coaSeeded = true on rerun", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo(buildFullAccountSet());
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    expect(result.seeded).toBe(true);
  });
});

// ── Suite 3: Partial state — some accounts exist, some are missing ─────────

describe("startup when some accounts exist and others are missing", () => {
  test("creates only the missing leaf accounts", async () => {
    // Pre-seed parents + cash only; everything else is absent
    const cashCode = DEFAULT_ACCOUNTING_CODES.cashAccountCode;
    const existingAccounts: Account[] = PARENT_ACCOUNT_BLUEPRINTS.map(
      (p, i) => ({
        id: i + 1,
        code: p.code,
        name: p.name,
        nameAr: p.nameAr,
        accountType: p.accountType,
        parentId: null,
        isSystem: true,
        isActive: true,
        balance: 0,
      }),
    );
    existingAccounts.push({
      id: 99,
      code: cashCode,
      name: "Cash",
      nameAr: "الصندوق",
      accountType: "asset",
      parentId: 1,
      isSystem: true,
      isActive: true,
      balance: 0,
    });

    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo(existingAccounts);
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    // Cash should NOT have been re-created
    expect(result.existingCodes).toContain(cashCode);
    expect(result.createdCodes).not.toContain(cashCode);

    // All missing leaf codes must have been created
    const missingLeafCodes = ALL_DEFAULT_LEAF_CODES.filter(
      (c) => c !== cashCode,
    );
    for (const code of missingLeafCodes) {
      expect(result.createdCodes).toContain(code);
    }
  });

  test("does not duplicate parent accounts", async () => {
    // Assets parent already exists; others are absent
    const existingAccounts: Account[] = [
      {
        id: 1,
        code: "1000",
        name: "Assets",
        nameAr: "الأصول",
        accountType: "asset",
        parentId: null,
        isSystem: true,
        isActive: true,
        balance: 0,
      },
    ];

    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo(existingAccounts);
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    // createAccountSync must not be called again with code "1000"
    const calls: string[] = accountingRepo.createAccountSync.mock.calls.map(
      (call) => (call[0] as { code: string }).code,
    );
    const duplicates = calls.filter((c) => c === "1000");
    expect(duplicates).toHaveLength(0);
  });

  test("sets coaSeeded = true only when all required accounts are present after partial fill", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    // Start with only parent accounts — all leaves are absent
    const accountingRepo = makeAccountingRepo(
      PARENT_ACCOUNT_BLUEPRINTS.map((p, i) => ({
        id: i + 1,
        code: p.code,
        name: p.name,
        nameAr: p.nameAr,
        accountType: p.accountType,
        parentId: null,
        isSystem: true,
        isActive: true,
        balance: 0,
      })),
    );
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    // All leaves are missing initially, use-case creates them → seeded = true
    expect(result.seeded).toBe(true);
    expect(result.missingCodes).toHaveLength(0);
  });
});

// ── Suite 4: accounting.enabled unset / null ──────────────────────────────

describe("accounting.enabled unset or null", () => {
  test("treats null as enabled and auto-sets the flag to true", async () => {
    const settingsRepo = makeSettingsRepo({}); // no enabled key
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    // Should have proceeded with seeding
    expect(result.enabled).toBe(true);
    expect(result.seeded).toBe(true);
    expect(settingsRepo._store.get(ACCOUNTING_SETTING_KEYS.enabled)).toBe(
      "true",
    );
  });

  test("creates the full chart of accounts when enabled was null", async () => {
    const settingsRepo = makeSettingsRepo({});
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    expect(result.createdCodes.length).toBeGreaterThan(0);
    for (const code of ALL_DEFAULT_LEAF_CODES) {
      expect(
        result.createdCodes.includes(code) ||
          result.existingCodes.includes(code),
      ).toBe(true);
    }
  });

  test("returns enabled = false without seeding when explicitly set to false", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "false",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    expect(result.enabled).toBe(false);
    expect(result.seeded).toBe(false);
    expect(result.createdCodes).toHaveLength(0);
    expect(accountingRepo.createAccountSync).not.toHaveBeenCalled();
  });
});

// ── Suite 5: Parent-child hierarchy correctness ───────────────────────────

describe("parent-child account hierarchy", () => {
  test("all five parent accounts are created with correct types and no parentId", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    for (const blueprint of PARENT_ACCOUNT_BLUEPRINTS) {
      const account = accountingRepo._accounts.get(blueprint.code);
      expect(account, `Parent ${blueprint.code} should exist`).toBeDefined();
      expect(account?.accountType).toBe(blueprint.accountType);
      expect(account?.parentId).toBeNull();
      expect(account?.isSystem).toBe(true);
    }
  });

  test("asset leaf accounts are children of the Assets parent (1000)", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    const assetsParentId = accountingRepo._accounts.get("1000")?.id;
    const assetLeafCodes = [
      DEFAULT_ACCOUNTING_CODES.cashAccountCode,
      DEFAULT_ACCOUNTING_CODES.arAccountCode,
      DEFAULT_ACCOUNTING_CODES.inventoryAccountCode,
      DEFAULT_ACCOUNTING_CODES.vatInputAccountCode,
    ];

    for (const code of assetLeafCodes) {
      const account = accountingRepo._accounts.get(code);
      expect(account?.parentId, `${code} should have Assets as parent`).toBe(
        assetsParentId,
      );
    }
  });

  test("liability leaf accounts are children of the Liabilities parent (2000)", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    const liabilitiesParentId = accountingRepo._accounts.get("2000")?.id;
    const liabilityLeafCodes = [
      DEFAULT_ACCOUNTING_CODES.apAccountCode,
      DEFAULT_ACCOUNTING_CODES.vatOutputAccountCode,
      DEFAULT_ACCOUNTING_CODES.deductionsLiabilityAccountCode,
    ];

    for (const code of liabilityLeafCodes) {
      const account = accountingRepo._accounts.get(code);
      expect(
        account?.parentId,
        `${code} should have Liabilities as parent`,
      ).toBe(liabilitiesParentId);
    }
  });

  test("revenue leaf accounts are children of the Revenue parent (4000)", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    const revenueParentId = accountingRepo._accounts.get("4000")?.id;
    const account = accountingRepo._accounts.get(
      DEFAULT_ACCOUNTING_CODES.salesRevenueAccountCode,
    );
    expect(account?.parentId).toBe(revenueParentId);
  });

  test("expense leaf accounts are children of the Expenses parent (5000)", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    const expensesParentId = accountingRepo._accounts.get("5000")?.id;
    const expenseLeafCodes = [
      DEFAULT_ACCOUNTING_CODES.cogsAccountCode,
      DEFAULT_ACCOUNTING_CODES.salaryExpenseAccountCode,
    ];

    for (const code of expenseLeafCodes) {
      const account = accountingRepo._accounts.get(code);
      expect(
        account?.parentId,
        `${code} should have Expenses as parent`,
      ).toBe(expensesParentId);
    }
  });

  test("parent accounts are created before leaf accounts (call order)", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");

    const calls = accountingRepo.createAccountSync.mock.calls as Array<
      [Omit<Account, "id" | "createdAt">]
    >;
    const createdCodes = calls.map(([data]) => data.code);

    // Every parent code must appear before any of its leaf children
    const parentPositions = Object.fromEntries(
      ALL_PARENT_CODES.map((code) => [code, createdCodes.indexOf(code)]),
    );

    for (const call of calls) {
      const [data] = call;
      if (data.parentId == null) continue; // parent account itself — skip
      const parentAccount = Array.from(accountingRepo._accounts.values()).find(
        (a) => a.id === data.parentId,
      );
      if (!parentAccount) continue;
      const parentPos = parentPositions[parentAccount.code];
      const leafPos = createdCodes.indexOf(data.code);
      expect(
        parentPos,
        `Parent ${parentAccount.code} must be created before child ${data.code}`,
      ).toBeLessThan(leafPos);
    }
  });
});

// ── Suite 6: Safe failure handling ────────────────────────────────────────

describe("safe failure handling", () => {
  test("does not set coaSeeded = true when a leaf account creation fails", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();

    // Make one specific leaf creation fail
    const failCode = DEFAULT_ACCOUNTING_CODES.cashAccountCode;
    accountingRepo.createAccountSync.mockImplementation(
      async (data: Omit<Account, "id" | "createdAt">) => {
        if (data.code === failCode) {
          throw new Error("DB constraint violation");
        }
        const account: Account = { ...data, id: nextId++ };
        accountingRepo._accounts.set(account.code, account);
        return account;
      },
    );

    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    expect(result.seeded).toBe(false);
    expect(settingsRepo._store.get(ACCOUNTING_SETTING_KEYS.coaSeeded)).toBe(
      "false",
    );
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.missingCodes).toContain(failCode);
  });

  test("emits a warning for each failed account without aborting the rest", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();

    // Fail all expense leaf accounts
    const failCodes = new Set([
      DEFAULT_ACCOUNTING_CODES.cogsAccountCode,
      DEFAULT_ACCOUNTING_CODES.salaryExpenseAccountCode,
    ]);

    accountingRepo.createAccountSync.mockImplementation(
      async (data: Omit<Account, "id" | "createdAt">) => {
        if (failCodes.has(data.code)) {
          throw new Error("Simulated failure");
        }
        const account: Account = { ...data, id: nextId++ };
        accountingRepo._accounts.set(account.code, account);
        return account;
      },
    );

    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const result = await useCase.execute({}, "system");

    // Non-failed accounts should still be created
    expect(
      accountingRepo._accounts.has(DEFAULT_ACCOUNTING_CODES.cashAccountCode),
    ).toBe(true);
    expect(
      accountingRepo._accounts.has(DEFAULT_ACCOUNTING_CODES.arAccountCode),
    ).toBe(true);

    // Warnings should mention both failed codes
    const warningText = result.warnings.join(" ");
    for (const code of failCodes) {
      expect(warningText).toContain(code);
    }
  });
});

// ── Suite 7: getStatus reflects current DB state ─────────────────────────

describe("getStatus", () => {
  test("reports seeded = false when coaSeeded flag is missing", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    // No accounts and no coaSeeded flag
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const status = await useCase.getStatus();

    expect(status.seeded).toBe(false);
    expect(status.enabled).toBe(true);
    expect(status.missingCodes.length).toBeGreaterThan(0);
  });

  test("reports enabled = null when accounting.enabled is not set", async () => {
    const settingsRepo = makeSettingsRepo({});
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    const status = await useCase.getStatus();

    expect(status.enabled).toBeNull();
    expect(status.seeded).toBe(false);
  });

  test("reports seeded = true after successful initialize", async () => {
    const settingsRepo = makeSettingsRepo({
      [ACCOUNTING_SETTING_KEYS.enabled]: "true",
    });
    const accountingRepo = makeAccountingRepo();
    const useCase = new InitializeAccountingUseCase(
      settingsRepo as never,
      accountingRepo as never,
    );

    await useCase.execute({}, "system");
    const status = await useCase.getStatus();

    expect(status.seeded).toBe(true);
    expect(status.missingCodes).toHaveLength(0);
  });
});
