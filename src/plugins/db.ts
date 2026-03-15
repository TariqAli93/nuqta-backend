import fp from "fastify-plugin";
import { JwtService, UnifiedSettingsService } from "../domain/index.js";
import type {
  AccountingRepository,
  AccountingSettingsRepository,
  AuditRepository,
  BackupRepository,
  BarcodeRepository,
  BarcodeSettingsRepository,
  CategoryRepository,
  CustomerLedgerRepository,
  CustomerRepository,
  DbConnection,
  EmployeeRepository,
  InventoryRepository,
  PaymentRepository,
  PayrollRepository,
  PosSettingsRepository,
  PostingRepository,
  ProductRepository,
  ProductWorkspaceRepository,
  PurchaseRepository,
  RevokedTokenRepository,
  SaleRepository,
  SettingsRepository,
  SupplierLedgerRepository,
  SupplierRepository,
  SystemSettingsRepository,
  UserRepository,
} from "../data/index.js";
import type { AppOptions } from "../app.js";

export interface Repositories {
  category: CategoryRepository;
  customer: CustomerRepository;
  supplier: SupplierRepository;
  employee: EmployeeRepository;
  product: ProductRepository;
  sale: SaleRepository;
  purchase: PurchaseRepository;
  payment: PaymentRepository;
  inventory: InventoryRepository;
  settings: SettingsRepository;
  systemSettings: SystemSettingsRepository;
  accountingSettings: AccountingSettingsRepository;
  posSettings: PosSettingsRepository;
  barcodeSettings: BarcodeSettingsRepository;
  user: UserRepository;
  audit: AuditRepository;
  barcode: BarcodeRepository;
  accounting: AccountingRepository;
  customerLedger: CustomerLedgerRepository;
  supplierLedger: SupplierLedgerRepository;
  posting: PostingRepository;
  payroll: PayrollRepository;
  productWorkspace: ProductWorkspaceRepository;
  backup: BackupRepository;
  revokedToken: RevokedTokenRepository;
}

export default fp<AppOptions>(async (fastify, opts) => {
  const overrides = opts.testOverrides;
  let connection = overrides?.db as DbConnection | undefined;
  let repos = overrides?.repos as Repositories | undefined;

  if (!connection || !repos) {
    const data = await import("../data/index.js");
    connection ??= data.db as DbConnection;
    repos ??= {
      category: new data.CategoryRepository(connection),
      customer: new data.CustomerRepository(connection),
      supplier: new data.SupplierRepository(connection),
      employee: new data.EmployeeRepository(connection),
      product: new data.ProductRepository(connection),
      sale: new data.SaleRepository(connection),
      purchase: new data.PurchaseRepository(connection),
      payment: new data.PaymentRepository(connection),
      inventory: new data.InventoryRepository(connection),
      settings: new data.SettingsRepository(connection),
      systemSettings: new data.SystemSettingsRepository(connection),
      accountingSettings: new data.AccountingSettingsRepository(connection),
      posSettings: new data.PosSettingsRepository(connection),
      barcodeSettings: new data.BarcodeSettingsRepository(connection),
      user: new data.UserRepository(connection),
      audit: new data.AuditRepository(connection),
      barcode: new data.BarcodeRepository(connection),
      accounting: new data.AccountingRepository(connection),
      customerLedger: new data.CustomerLedgerRepository(connection),
      supplierLedger: new data.SupplierLedgerRepository(connection),
      posting: new data.PostingRepository(connection),
      payroll: new data.PayrollRepository(connection),
      productWorkspace: new data.ProductWorkspaceRepository(connection),
      backup: new data.BackupRepository(),
      revokedToken: new data.RevokedTokenRepository(connection),
    } as Repositories;
  }

  const jwtSecret = process.env.JWT_SECRET || "nuqta-secret-dev";
  const accessTtl = parseInt(process.env.JWT_ACCESS_TTL || "900", 10); // 15 min
  const refreshTtl = parseInt(process.env.JWT_REFRESH_TTL || "604800", 10); // 7 days
  const jwtService =
    (overrides?.jwt as JwtService | undefined) ??
    new JwtService(jwtSecret, accessTtl, refreshTtl);

  const settingsFacade =
    (overrides?.settings as UnifiedSettingsService | undefined) ??
    new UnifiedSettingsService(
      repos.settings,
      repos.accountingSettings,
      repos.posSettings,
      repos.barcodeSettings,
      repos.systemSettings,
    );

  fastify.decorate("db", connection);
  fastify.decorate("repos", repos);
  fastify.decorate("jwt", jwtService);
  fastify.decorate("settings", settingsFacade);
});

declare module "fastify" {
  export interface FastifyInstance {
    db: DbConnection;
    repos: Repositories;
    jwt: JwtService;
    settings: UnifiedSettingsService;
  }
}
