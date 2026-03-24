import { vi } from "vitest";

const repositoryNames = [
  "AccountingRepository",
  "AccountingSettingsRepository",
  "AuditRepository",
  "BackupRepository",
  "BarcodeRepository",
  "BarcodeSettingsRepository",
  "CategoryRepository",
  "CustomerLedgerRepository",
  "CustomerRepository",
  "EmployeeRepository",
  "InventoryRepository",
  "PaymentRepository",
  "PayrollRepository",
  "PosSettingsRepository",
  "PostingRepository",
  "ProductRepository",
  "ProductWorkspaceRepository",
  "PurchaseInvoicePaymentRepository",
  "PurchaseRepository",
  "SaleRepository",
  "SalesInvoicePaymentRepository",
  "SettingsRepository",
  "SupplierLedgerRepository",
  "SupplierRepository",
  "SystemSettingsRepository",
  "UserRepository",
] as const;

type RepositoryName = (typeof repositoryNames)[number];

const state = vi.hoisted(() => {
  const names = [
    "AccountingRepository",
    "AccountingSettingsRepository",
    "AuditRepository",
    "BackupRepository",
    "BarcodeRepository",
    "BarcodeSettingsRepository",
    "CategoryRepository",
    "CustomerLedgerRepository",
    "CustomerRepository",
    "EmployeeRepository",
    "InventoryRepository",
    "PaymentRepository",
    "PayrollRepository",
    "PosSettingsRepository",
    "PostingRepository",
    "ProductRepository",
    "ProductWorkspaceRepository",
    "PurchaseInvoicePaymentRepository",
    "PurchaseRepository",
    "SaleRepository",
    "SalesInvoicePaymentRepository",
    "SettingsRepository",
    "SupplierLedgerRepository",
    "SupplierRepository",
    "SystemSettingsRepository",
    "UserRepository",
  ] as const;
  const repoInstances = {} as Record<RepositoryName, unknown[][]>;

  for (const name of names) {
    repoInstances[name] = [];
  }

  return {
    db: { name: "mock-db" } as Record<string, unknown>,
    repoInstances,
    fifoInstances: [] as unknown[][],
    fifoDeplete: vi.fn(async () => ({
      depletions: [],
      totalCost: 0,
      weightedAverageCost: 0,
    })),
    fifoGetAvailableStock: vi.fn(async () => 0),
  };
});

vi.mock("../../src/data/index.js", () => {
  const names = Object.keys(state.repoInstances) as RepositoryName[];
  const repoExports = Object.fromEntries(
    names.map((name) => [
      name,
      class RepositoryMock {
        db: unknown;

        constructor(db: unknown) {
          this.db = db;
          state.repoInstances[name].push([db]);
        }
      },
    ]),
  );

  return {
    get db() {
      return state.db;
    },
    ...repoExports,
    FifoService: class FifoServiceMock {
      db: unknown;

      constructor(db: unknown) {
        this.db = db;
        state.fifoInstances.push([db]);
      }

      deplete(...args: unknown[]) {
        return state.fifoDeplete(...args);
      }

      getAvailableStock(...args: unknown[]) {
        return state.fifoGetAvailableStock(...args);
      }
    },
  };
});

export function resetMockData() {
  state.db = { name: "mock-db" };
  state.fifoInstances.length = 0;
  state.fifoDeplete.mockReset();
  state.fifoDeplete.mockResolvedValue({
    depletions: [],
    totalCost: 0,
    weightedAverageCost: 0,
  });
  state.fifoGetAvailableStock.mockReset();
  state.fifoGetAvailableStock.mockResolvedValue(0);

  for (const name of Object.keys(state.repoInstances) as RepositoryName[]) {
    state.repoInstances[name].length = 0;
  }
}

export function setMockDb(db: Record<string, unknown>) {
  state.db = db;
}

export function getFifoMocks() {
  return {
    instances: state.fifoInstances,
    deplete: state.fifoDeplete,
    getAvailableStock: state.fifoGetAvailableStock,
  };
}

export function getRepositoryInstances(name: RepositoryName) {
  return state.repoInstances[name];
}
