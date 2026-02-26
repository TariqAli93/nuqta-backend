import fp from "fastify-plugin";
import { db, type DbConnection } from "@nuqta/data";
import {
  CategoryRepository,
  CustomerRepository,
  SupplierRepository,
  ProductRepository,
  SaleRepository,
  PurchaseRepository,
  PaymentRepository,
  InventoryRepository,
  SettingsRepository,
  UserRepository,
  AuditRepository,
  BarcodeRepository,
  AccountingRepository,
  CustomerLedgerRepository,
  SupplierLedgerRepository,
  PostingRepository,
  ProductWorkspaceRepository,
} from "@nuqta/data";
import { JwtService } from "@nuqta/core";

export interface Repositories {
  category: InstanceType<typeof CategoryRepository>;
  customer: InstanceType<typeof CustomerRepository>;
  supplier: InstanceType<typeof SupplierRepository>;
  product: InstanceType<typeof ProductRepository>;
  sale: InstanceType<typeof SaleRepository>;
  purchase: InstanceType<typeof PurchaseRepository>;
  payment: InstanceType<typeof PaymentRepository>;
  inventory: InstanceType<typeof InventoryRepository>;
  settings: InstanceType<typeof SettingsRepository>;
  user: InstanceType<typeof UserRepository>;
  audit: InstanceType<typeof AuditRepository>;
  barcode: InstanceType<typeof BarcodeRepository>;
  accounting: InstanceType<typeof AccountingRepository>;
  customerLedger: InstanceType<typeof CustomerLedgerRepository>;
  supplierLedger: InstanceType<typeof SupplierLedgerRepository>;
  posting: InstanceType<typeof PostingRepository>;
  productWorkspace: InstanceType<typeof ProductWorkspaceRepository>;
}

export default fp(async (fastify) => {
  const repos: Repositories = {
    category: new CategoryRepository(db),
    customer: new CustomerRepository(db),
    supplier: new SupplierRepository(db),
    product: new ProductRepository(db),
    sale: new SaleRepository(db),
    purchase: new PurchaseRepository(db),
    payment: new PaymentRepository(db),
    inventory: new InventoryRepository(db),
    settings: new SettingsRepository(db),
    user: new UserRepository(db),
    audit: new AuditRepository(db),
    barcode: new BarcodeRepository(db),
    accounting: new AccountingRepository(db),
    customerLedger: new CustomerLedgerRepository(db),
    supplierLedger: new SupplierLedgerRepository(db),
    posting: new PostingRepository(db),
    productWorkspace: new ProductWorkspaceRepository(db),
  };

  const jwtSecret = process.env.JWT_SECRET || "nuqta-secret-dev";
  const jwtService = new JwtService(jwtSecret, 86400); // 24h tokens

  fastify.decorate("db", db);
  fastify.decorate("repos", repos);
  fastify.decorate("jwt", jwtService);
});

declare module "fastify" {
  export interface FastifyInstance {
    db: DbConnection;
    repos: Repositories;
    jwt: JwtService;
  }
}
