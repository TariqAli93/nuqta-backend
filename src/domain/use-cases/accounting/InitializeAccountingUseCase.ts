import type { Account } from "../../entities/Accounting.js";
import { IAccountingRepository } from "../../interfaces/IAccountingRepository.js";
import { ISettingsRepository } from "../../interfaces/ISettingsRepository.js";
import { WriteUseCase } from "../../shared/WriteUseCase.js";

export const ACCOUNTING_SETTING_KEYS = {
  enabled: "accounting.enabled",
  coaSeeded: "accounting.coaSeeded",
  baseCurrency: "currency.base",
  cashAccountCode: "accounting.cashAccountCode",
  salaryExpenseAccountCode: "accounting.salaryExpenseAccountCode",
  deductionsLiabilityAccountCode: "accounting.deductionsLiabilityAccountCode",
  inventoryAccountCode: "accounting.inventoryAccountCode",
  arAccountCode: "accounting.arAccountCode",
  apAccountCode: "accounting.apAccountCode",
  salesRevenueAccountCode: "accounting.salesRevenueAccountCode",
  cogsAccountCode: "accounting.cogsAccountCode",
  vatInputAccountCode: "accounting.vatInputAccountCode",
  vatOutputAccountCode: "accounting.vatOutputAccountCode",
} as const;

export const DEFAULT_ACCOUNTING_CODES = {
  cashAccountCode: "1001",
  salaryExpenseAccountCode: "5002",
  deductionsLiabilityAccountCode: "2101",
  arAccountCode: "1100",
  inventoryAccountCode: "1200",
  vatInputAccountCode: "1300",
  apAccountCode: "2100",
  vatOutputAccountCode: "2200",
  salesRevenueAccountCode: "4001",
  cogsAccountCode: "5001",
} as const;

export interface AccountingCodeSelections {
  cashAccountCode: string;
  salaryExpenseAccountCode: string;
  deductionsLiabilityAccountCode: string;
  inventoryAccountCode: string;
  arAccountCode: string;
  apAccountCode: string;
  salesRevenueAccountCode: string;
  cogsAccountCode: string;
  vatInputAccountCode: string;
  vatOutputAccountCode: string;
}

export interface AccountingSetupStatus {
  enabled: boolean | null;
  seeded: boolean;
  missingCodes: string[];
  selectedCodes: AccountingCodeSelections;
  baseCurrency: string | null;
  warnings: string[];
}

export interface InitializeAccountingInput {
  baseCurrency?: string;
  cashAccountCode?: string;
  salaryExpenseAccountCode?: string;
  deductionsLiabilityAccountCode?: string;
  inventoryAccountCode?: string;
  arAccountCode?: string;
  apAccountCode?: string;
  salesRevenueAccountCode?: string;
  cogsAccountCode?: string;
  vatInputAccountCode?: string;
  vatOutputAccountCode?: string;
}

export interface InitializeAccountingResult extends AccountingSetupStatus {
  message: string;
  createdCodes: string[];
  existingCodes: string[];
}

// ── System parent accounts (structural, not user-configurable) ─────────────

type ParentBlueprint = {
  code: string;
  name: string;
  nameAr: string;
  accountType: Account["accountType"];
};

/**
 * Top-level system accounts.  Created before any leaf account so children
 * can reference them via parentId.  Codes are fixed and never stored in
 * user-configurable settings.
 */
export const PARENT_ACCOUNT_BLUEPRINTS: ParentBlueprint[] = [
  { code: "1000", name: "Assets", nameAr: "الأصول", accountType: "asset" },
  {
    code: "2000",
    name: "Liabilities",
    nameAr: "الخصوم",
    accountType: "liability",
  },
  {
    code: "3000",
    name: "Equity",
    nameAr: "حقوق الملكية",
    accountType: "equity",
  },
  {
    code: "4000",
    name: "Revenue",
    nameAr: "الإيرادات",
    accountType: "revenue",
  },
  {
    code: "5000",
    name: "Expenses",
    nameAr: "المصروفات",
    accountType: "expense",
  },
];

// ── Leaf accounts (configurable codes, fixed parent mapping) ───────────────

type AccountBlueprint = {
  selectionKey: keyof AccountingCodeSelections;
  name: string;
  nameAr: string;
  accountType: Account["accountType"];
  /** Code of the parent from PARENT_ACCOUNT_BLUEPRINTS */
  parentCode: string;
};

const ACCOUNT_BLUEPRINTS: AccountBlueprint[] = [
  {
    selectionKey: "cashAccountCode",
    name: "Cash",
    nameAr: "الصندوق",
    accountType: "asset",
    parentCode: "1000",
  },
  {
    selectionKey: "arAccountCode",
    name: "Accounts Receivable",
    nameAr: "ذمم العملاء",
    accountType: "asset",
    parentCode: "1000",
  },
  {
    selectionKey: "inventoryAccountCode",
    name: "Inventory",
    nameAr: "المخزون",
    accountType: "asset",
    parentCode: "1000",
  },
  {
    selectionKey: "vatInputAccountCode",
    name: "VAT Input",
    nameAr: "ضريبة المدخلات",
    accountType: "asset",
    parentCode: "1000",
  },
  {
    selectionKey: "apAccountCode",
    name: "Accounts Payable",
    nameAr: "ذمم الموردين",
    accountType: "liability",
    parentCode: "2000",
  },
  {
    selectionKey: "vatOutputAccountCode",
    name: "VAT Output",
    nameAr: "ضريبة المخرجات",
    accountType: "liability",
    parentCode: "2000",
  },
  {
    selectionKey: "deductionsLiabilityAccountCode",
    name: "Salary Deductions Payable",
    nameAr: "اقتطاعات الرواتب المستحقة",
    accountType: "liability",
    parentCode: "2000",
  },
  {
    selectionKey: "salesRevenueAccountCode",
    name: "Sales Revenue",
    nameAr: "إيرادات المبيعات",
    accountType: "revenue",
    parentCode: "4000",
  },
  {
    selectionKey: "cogsAccountCode",
    name: "Cost of Goods Sold",
    nameAr: "تكلفة البضاعة",
    accountType: "expense",
    parentCode: "5000",
  },
  {
    selectionKey: "salaryExpenseAccountCode",
    name: "Salary Expense",
    nameAr: "مصروفات الرواتب",
    accountType: "expense",
    parentCode: "5000",
  },
];

export class InitializeAccountingUseCase extends WriteUseCase<
  InitializeAccountingInput,
  InitializeAccountingResult,
  InitializeAccountingResult
> {
  constructor(
    private settingsRepo: ISettingsRepository,
    private accountingRepo: IAccountingRepository,
  ) {
    super();
  }

  async getStatus(): Promise<AccountingSetupStatus> {
    const enabled = await this.readEnabled();
    const selectedCodes = await this.resolveSelectedCodes();
    const seededFlag =
      (await this.settingsRepo.get(ACCOUNTING_SETTING_KEYS.coaSeeded)) ===
      "true";
    const missingCodes =
      enabled === true ? await this.findMissingCodes(selectedCodes) : [];
    const seeded =
      enabled === true ? seededFlag && missingCodes.length === 0 : false;
    const warnings =
      enabled === true && missingCodes.length > 0
        ? [`Missing account codes: ${missingCodes.join(", ")}`]
        : [];

    return {
      enabled,
      seeded,
      missingCodes,
      selectedCodes,
      baseCurrency: await this.settingsRepo.get(
        ACCOUNTING_SETTING_KEYS.baseCurrency,
      ),
      warnings,
    };
  }

  async executeCommitPhase(
    input: InitializeAccountingInput,
    _userId: string,
  ): Promise<InitializeAccountingResult> {
    await this.persistConfiguration(input);

    let enabled = await this.readEnabled();

    // Requirement: if accounting.enabled is null/missing (first-run), treat as
    // enabled and persist the flag so subsequent reads are consistent.
    if (enabled === null) {
      await this.settingsRepo.set(ACCOUNTING_SETTING_KEYS.enabled, "true");
      enabled = true;
    }

    if (enabled !== true) {
      await this.settingsRepo.set(ACCOUNTING_SETTING_KEYS.coaSeeded, "false");
      const selectedCodes = await this.resolveSelectedCodes(input);
      return {
        enabled,
        seeded: false,
        missingCodes: [],
        selectedCodes,
        baseCurrency: await this.settingsRepo.get(
          ACCOUNTING_SETTING_KEYS.baseCurrency,
        ),
        warnings: [],
        message: "Accounting disabled; nothing to seed.",
        createdCodes: [],
        existingCodes: [],
      };
    }

    const selectedCodes = await this.resolveSelectedCodes(input);
    const createdCodes: string[] = [];
    const existingCodes: string[] = [];
    const warnings: string[] = [];

    // ── Step 1: ensure parent accounts exist first ─────────────────────────
    const parentIdMap = await this.ensureParentAccounts(
      createdCodes,
      existingCodes,
      warnings,
    );

    // ── Step 2: seed leaf accounts with correct parentId ──────────────────
    for (const blueprint of ACCOUNT_BLUEPRINTS) {
      const code = selectedCodes[blueprint.selectionKey];
      if (!code) {
        warnings.push(`Missing code for ${blueprint.selectionKey}.`);
        continue;
      }

      const existing = await this.accountingRepo.findAccountByCode(code);
      if (existing) {
        existingCodes.push(code);
        continue;
      }

      const parentId = parentIdMap.get(blueprint.parentCode) ?? null;
      try {
        await this.accountingRepo.createAccountSync({
          code,
          name: blueprint.name,
          nameAr: blueprint.nameAr,
          accountType: blueprint.accountType,
          parentId,
          isSystem: true,
          isActive: true,
          balance: 0,
        });
        createdCodes.push(code);
      } catch (error: unknown) {
        warnings.push(
          `Failed seeding account ${code}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    // ── Step 3: verify completeness and persist flag ───────────────────────
    const missingCodes = await this.findMissingCodes(selectedCodes);
    if (missingCodes.length > 0) {
      warnings.push(`Missing account codes: ${missingCodes.join(", ")}`);
    }

    const seeded = missingCodes.length === 0;
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.coaSeeded,
      seeded ? "true" : "false",
    );

    return {
      enabled,
      seeded,
      missingCodes,
      selectedCodes,
      baseCurrency: await this.settingsRepo.get(
        ACCOUNTING_SETTING_KEYS.baseCurrency,
      ),
      warnings,
      message: seeded
        ? "Default chart of accounts is ready."
        : "Chart of accounts is incomplete.",
      createdCodes,
      existingCodes,
    };
  }

  executeSideEffectsPhase(
    _result: InitializeAccountingResult,
    _userId: string,
  ): Promise<void> {
    return Promise.resolve();
  }

  toEntity(result: InitializeAccountingResult): InitializeAccountingResult {
    return result;
  }

  /**
   * Ensure all system parent accounts exist.
   * Returns a Map<parentCode, parentId> for use when linking leaf accounts.
   * Parents already in the DB are reused; only missing ones are created.
   */
  private async ensureParentAccounts(
    createdCodes: string[],
    existingCodes: string[],
    warnings: string[],
  ): Promise<Map<string, number>> {
    const map = new Map<string, number>();

    for (const parent of PARENT_ACCOUNT_BLUEPRINTS) {
      const existing = await this.accountingRepo.findAccountByCode(parent.code);
      if (existing?.id != null) {
        map.set(parent.code, existing.id);
        existingCodes.push(parent.code);
        continue;
      }

      try {
        const created = await this.accountingRepo.createAccountSync({
          code: parent.code,
          name: parent.name,
          nameAr: parent.nameAr,
          accountType: parent.accountType,
          parentId: null,
          isSystem: true,
          isActive: true,
          balance: 0,
        });
        if (created.id != null) {
          map.set(parent.code, created.id);
          createdCodes.push(parent.code);
        }
      } catch (error: unknown) {
        warnings.push(
          `Failed seeding parent account ${parent.code}: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }

    return map;
  }

  private async persistConfiguration(
    input: InitializeAccountingInput,
  ): Promise<void> {
    if (input.baseCurrency && input.baseCurrency.trim().length > 0) {
      await this.settingsRepo.set(
        ACCOUNTING_SETTING_KEYS.baseCurrency,
        input.baseCurrency.trim(),
      );
    }

    const selected = await this.resolveSelectedCodes(input);
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.cashAccountCode,
      selected.cashAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.salaryExpenseAccountCode,
      selected.salaryExpenseAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.deductionsLiabilityAccountCode,
      selected.deductionsLiabilityAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.inventoryAccountCode,
      selected.inventoryAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.arAccountCode,
      selected.arAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.apAccountCode,
      selected.apAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.salesRevenueAccountCode,
      selected.salesRevenueAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.cogsAccountCode,
      selected.cogsAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.vatInputAccountCode,
      selected.vatInputAccountCode,
    );
    await this.settingsRepo.set(
      ACCOUNTING_SETTING_KEYS.vatOutputAccountCode,
      selected.vatOutputAccountCode,
    );
  }

  private async resolveSelectedCodes(
    input: InitializeAccountingInput = {},
  ): Promise<AccountingCodeSelections> {
    return {
      cashAccountCode: await this.resolveCode(
        input.cashAccountCode,
        ACCOUNTING_SETTING_KEYS.cashAccountCode,
        DEFAULT_ACCOUNTING_CODES.cashAccountCode,
      ),
      salaryExpenseAccountCode: await this.resolveCode(
        input.salaryExpenseAccountCode,
        ACCOUNTING_SETTING_KEYS.salaryExpenseAccountCode,
        DEFAULT_ACCOUNTING_CODES.salaryExpenseAccountCode,
      ),
      deductionsLiabilityAccountCode: await this.resolveCode(
        input.deductionsLiabilityAccountCode,
        ACCOUNTING_SETTING_KEYS.deductionsLiabilityAccountCode,
        DEFAULT_ACCOUNTING_CODES.deductionsLiabilityAccountCode,
      ),
      inventoryAccountCode: await this.resolveCode(
        input.inventoryAccountCode,
        ACCOUNTING_SETTING_KEYS.inventoryAccountCode,
        DEFAULT_ACCOUNTING_CODES.inventoryAccountCode,
      ),
      arAccountCode: await this.resolveCode(
        input.arAccountCode,
        ACCOUNTING_SETTING_KEYS.arAccountCode,
        DEFAULT_ACCOUNTING_CODES.arAccountCode,
      ),
      apAccountCode: await this.resolveCode(
        input.apAccountCode,
        ACCOUNTING_SETTING_KEYS.apAccountCode,
        DEFAULT_ACCOUNTING_CODES.apAccountCode,
      ),
      salesRevenueAccountCode: await this.resolveCode(
        input.salesRevenueAccountCode,
        ACCOUNTING_SETTING_KEYS.salesRevenueAccountCode,
        DEFAULT_ACCOUNTING_CODES.salesRevenueAccountCode,
      ),
      cogsAccountCode: await this.resolveCode(
        input.cogsAccountCode,
        ACCOUNTING_SETTING_KEYS.cogsAccountCode,
        DEFAULT_ACCOUNTING_CODES.cogsAccountCode,
      ),
      vatInputAccountCode: await this.resolveCode(
        input.vatInputAccountCode,
        ACCOUNTING_SETTING_KEYS.vatInputAccountCode,
        DEFAULT_ACCOUNTING_CODES.vatInputAccountCode,
      ),
      vatOutputAccountCode: await this.resolveCode(
        input.vatOutputAccountCode,
        ACCOUNTING_SETTING_KEYS.vatOutputAccountCode,
        DEFAULT_ACCOUNTING_CODES.vatOutputAccountCode,
      ),
    };
  }

  private async resolveCode(
    inputCode: string | undefined,
    key: string,
    fallback: string,
  ): Promise<string> {
    const direct = inputCode?.trim();
    if (direct) return direct;

    const fromSettings = (await this.settingsRepo.get(key))?.trim();
    if (fromSettings) return fromSettings;

    return fallback;
  }

  private async readEnabled(): Promise<boolean | null> {
    const raw = await this.settingsRepo.get(ACCOUNTING_SETTING_KEYS.enabled);
    if (raw === "true") return true;
    if (raw === "false") return false;
    return null;
  }

  private async findMissingCodes(
    selectedCodes: AccountingCodeSelections,
  ): Promise<string[]> {
    const uniqueCodes = Array.from(
      new Set(Object.values(selectedCodes).map((code) => code.trim())),
    );
    const missing: string[] = [];
    for (const code of uniqueCodes) {
      const acct = await this.accountingRepo.findAccountByCode(code);
      if (!acct?.id) missing.push(code);
    }
    return missing;
  }
}
