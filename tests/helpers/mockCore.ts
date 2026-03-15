import { vi } from "vitest";

const useCaseNames = [
  "LoginUseCase",
  "RegisterFirstUserUseCase",
  "CheckInitialSetupUseCase",
  "CreateUserUseCase",
  "UpdateUserUseCase",
  "CreateCategoryUseCase",
  "UpdateCategoryUseCase",
  "CreateCustomerUseCase",
  "UpdateCustomerUseCase",
  "CreateSupplierUseCase",
  "UpdateSupplierUseCase",
  "GetProductsUseCase",
  "CreateProductUseCase",
  "UpdateProductUseCase",
  "DeleteProductUseCase",
  "AdjustProductStockUseCase",
  "ReconcileStockUseCase",
  "CreateSaleUseCase",
  "AddPaymentUseCase",
  "CreatePurchaseUseCase",
  "AddPurchasePaymentUseCase",
  "SetCompanySettingsUseCase",
  "GetModuleSettingsUseCase",
  "CompleteSetupWizardUseCase",
  "GetDashboardStatsUseCase",
  "GetInventoryMovementsUseCase",
  "GetInventoryDashboardUseCase",
  "GetExpiryAlertsUseCase",
  "PostPeriodUseCase",
  "ReverseEntryUseCase",
  "PostIndividualEntryUseCase",
  "UnpostIndividualEntryUseCase",
  "LockPostingBatchUseCase",
  "UnlockPostingBatchUseCase",
  "RecordSupplierPaymentUseCase",
  "ReconcileSupplierBalanceUseCase",
  "RecordCustomerPaymentUseCase",
  "AddCustomerLedgerAdjustmentUseCase",
  "ReconcileCustomerDebtUseCase",
  "InitializeAccountingUseCase",
  "GetEmployeeByIdUseCase",
  "CreateEmployeeUseCase",
  "UpdateEmployeeUseCase",
  "GetPayrollRunByIdUseCase",
  "CreatePayrollRunUseCase",
  "ApprovePayrollRunUseCase",
  "GetProductPurchaseHistoryUseCase",
  "GetProductSalesHistoryUseCase",
] as const;

export type UseCaseName = (typeof useCaseNames)[number];
export type UseCaseMethod = "execute" | "executeCommitPhase" | "getStatus" | "repair";

type MockFn = ReturnType<typeof vi.fn>;

interface UseCaseState {
  constructors: unknown[][];
  methods: Record<UseCaseMethod, MockFn>;
}

const state = vi.hoisted(() => {
  const names = [
    "LoginUseCase",
    "RegisterFirstUserUseCase",
    "CheckInitialSetupUseCase",
    "CreateUserUseCase",
    "UpdateUserUseCase",
    "CreateCategoryUseCase",
    "UpdateCategoryUseCase",
    "CreateCustomerUseCase",
    "UpdateCustomerUseCase",
    "CreateSupplierUseCase",
    "UpdateSupplierUseCase",
    "GetProductsUseCase",
    "CreateProductUseCase",
    "UpdateProductUseCase",
    "DeleteProductUseCase",
    "AdjustProductStockUseCase",
    "ReconcileStockUseCase",
    "CreateSaleUseCase",
    "AddPaymentUseCase",
    "CreatePurchaseUseCase",
    "AddPurchasePaymentUseCase",
    "SetCompanySettingsUseCase",
    "GetModuleSettingsUseCase",
    "CompleteSetupWizardUseCase",
    "GetDashboardStatsUseCase",
    "GetInventoryMovementsUseCase",
    "GetInventoryDashboardUseCase",
    "GetExpiryAlertsUseCase",
    "PostPeriodUseCase",
    "ReverseEntryUseCase",
    "PostIndividualEntryUseCase",
    "UnpostIndividualEntryUseCase",
    "LockPostingBatchUseCase",
    "UnlockPostingBatchUseCase",
    "RecordSupplierPaymentUseCase",
    "ReconcileSupplierBalanceUseCase",
    "RecordCustomerPaymentUseCase",
    "AddCustomerLedgerAdjustmentUseCase",
    "ReconcileCustomerDebtUseCase",
    "InitializeAccountingUseCase",
    "GetEmployeeByIdUseCase",
    "CreateEmployeeUseCase",
    "UpdateEmployeeUseCase",
    "GetPayrollRunByIdUseCase",
    "CreatePayrollRunUseCase",
    "ApprovePayrollRunUseCase",
    "GetProductPurchaseHistoryUseCase",
    "GetProductSalesHistoryUseCase",
  ] as const;
  const registry = {} as Record<UseCaseName, UseCaseState>;

  for (const name of names) {
    registry[name] = {
      constructors: [],
      methods: {
        execute: vi.fn(async () => {
          throw new Error(`${name}.execute mock not configured`);
        }),
        executeCommitPhase: vi.fn(async () => {
          throw new Error(`${name}.executeCommitPhase mock not configured`);
        }),
        getStatus: vi.fn(async () => {
          throw new Error(`${name}.getStatus mock not configured`);
        }),
        repair: vi.fn(async () => {
          throw new Error(`${name}.repair mock not configured`);
        }),
      },
    };
  }

  return { registry };
});

vi.mock("../../src/domain/index.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/domain/index.js")>("../../src/domain/index.js");
  const names = Object.keys(state.registry) as UseCaseName[];

  const mockedUseCases = Object.fromEntries(
    names.map((name) => [
      name,
      class MockedUseCase {
        constructor(...args: unknown[]) {
          state.registry[name].constructors.push(args);
        }

        execute(...args: unknown[]) {
          return state.registry[name].methods.execute(...args);
        }

        executeCommitPhase(...args: unknown[]) {
          return state.registry[name].methods.executeCommitPhase(...args);
        }

        getStatus(...args: unknown[]) {
          return state.registry[name].methods.getStatus(...args);
        }

        repair(...args: unknown[]) {
          return state.registry[name].methods.repair(...args);
        }
      },
    ]),
  );

  return {
    ...actual,
    ...mockedUseCases,
  };
});

function applyMockValue(mock: MockFn, name: UseCaseName, method: UseCaseMethod, value?: unknown) {
  mock.mockReset();

  if (typeof value === "function") {
    mock.mockImplementation(value as (...args: unknown[]) => unknown);
    return;
  }

  if (value !== undefined) {
    mock.mockResolvedValue(value);
    return;
  }

  mock.mockImplementation(async () => {
    throw new Error(`${name}.${method} mock not configured`);
  });
}

export function resetMockCore() {
  for (const name of Object.keys(state.registry) as UseCaseName[]) {
    const entry = state.registry[name];
    entry.constructors.length = 0;
    applyMockValue(entry.methods.execute, name, "execute");
    applyMockValue(entry.methods.executeCommitPhase, name, "executeCommitPhase");
    applyMockValue(entry.methods.getStatus, name, "getStatus");
    applyMockValue(entry.methods.repair, name, "repair");
  }
}

export function mockUseCase(
  name: UseCaseName,
  methods: Partial<Record<UseCaseMethod, unknown>>,
) {
  const entry = state.registry[name];

  for (const method of Object.keys(methods) as UseCaseMethod[]) {
    applyMockValue(entry.methods[method], name, method, methods[method]);
  }
}

export function getUseCaseMock(name: UseCaseName, method: UseCaseMethod) {
  return state.registry[name].methods[method];
}

export function getUseCaseConstructors(name: UseCaseName) {
  return state.registry[name].constructors;
}
