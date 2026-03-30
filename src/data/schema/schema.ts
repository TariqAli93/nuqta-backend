import { sql } from "drizzle-orm";
import {
  pgTable,
  pgEnum,
  type AnyPgColumn,
  text,
  integer,
  numeric,
  serial,
  boolean,
  timestamp,
  date,
  index,
  uniqueIndex,
  uuid,
  check,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "manager", "cashier"]);
export const productStatusEnum = pgEnum("product_status", [
  "available",
  "out_of_stock",
  "discontinued",
]);
export const productBatchStatusEnum = pgEnum("product_batch_status", [
  "active",
  "expired",
  "depleted",
  "recalled",
]);
export const saleStatusEnum = pgEnum("sale_status", [
  "pending",
  "completed",
  "cancelled",
  "refunded",
  "partial_refund",
]);
export const salePaymentTypeEnum = pgEnum("sale_payment_type", [
  "cash",
  "credit",
  "mixed",
]);
export const salePaymentMethodEnum = pgEnum("sale_payment_method", [
  "cash",
  "card",
  "bank_transfer",
  "credit",
]);
export const printStatusEnum = pgEnum("print_status", [
  "pending",
  "printed",
  "failed",
]);
export const purchaseStatusEnum = pgEnum("purchase_status", [
  "pending",
  "completed",
  "cancelled",
  "received",
  "partial",
]);
export const paymentStatusEnum = pgEnum("payment_status", [
  "pending",
  "completed",
  "voided",
  "refunded",
  "failed",
]);
export const paymentMethodEnum = pgEnum("payment_method", [
  "cash",
  "card",
  "bank_transfer",
  "credit",
  "refund",
]);
export const inventoryMovementTypeEnum = pgEnum("inventory_movement_type", [
  "in",
  "out",
  "adjust",
]);
export const inventoryMovementReasonEnum = pgEnum("inventory_movement_reason", [
  "sale",
  "purchase",
  "return",
  "cancellation",
  "refund",
  "damage",
  "manual",
  "opening",
]);
export const payrollRunStatusEnum = pgEnum("payroll_run_status", [
  "draft",
  "submitted",
  "approved",
  "disbursed",
  "cancelled",
]);
export const accountTypeEnum = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);
export const postingBatchPeriodTypeEnum = pgEnum("posting_batch_period_type", [
  "day",
  "month",
  "year",
]);
export const postingBatchStatusEnum = pgEnum("posting_batch_status", [
  "draft",
  "posted",
  "locked",
]);
export const reconciliationTypeEnum = pgEnum("reconciliation_type", [
  "customer",
  "supplier",
  "account",
]);
export const reconciliationStatusEnum = pgEnum("reconciliation_status", [
  "open",
  "partially_paid",
  "paid",
]);
export const journalSourceTypeEnum = pgEnum("journal_source_type", [
  "sale",
  "purchase",
  "payment",
  "adjustment",
  "manual",
  "sale_cancellation",
  "sale_refund",
  "payment_reversal",
  "credit_note",
  "payroll",
]);
export const barcodeTypeEnum = pgEnum("barcode_type", [
  "CODE128",
  "EAN13",
  "EAN8",
  "UPC",
  "QR",
]);
export const barcodePrintJobStatusEnum = pgEnum("barcode_print_job_status", [
  "pending",
  "printed",
  "failed",
]);
export const posPaperSizeEnum = pgEnum("pos_paper_size", [
  "thermal",
  "a4",
  "letter",
]);
export const posLayoutDirectionEnum = pgEnum("pos_layout_direction", [
  "rtl",
  "ltr",
]);
export const accountingCostMethodEnum = pgEnum("accounting_cost_method", [
  "fifo",
  "weighted_average",
]);
export const accountingRoundingMethodEnum = pgEnum("accounting_rounding_method", [
  "round",
  "floor",
  "ceil",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: userRoleEnum("role").notNull().default("cashier"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
});

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  totalPurchases: integer("total_purchases").notNull().default(0),
  totalDebt: integer("total_debt").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  phone2: text("phone2"),
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  openingBalance: integer("opening_balance").notNull().default(0),
  currentBalance: integer("current_balance").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  check("chk_suppliers_opening_balance_nonnegative", sql`${table.openingBalance} >= 0`),
]);

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});

// `products.stock` is intentionally retained as a cache for backward
// compatibility. The migration installs a trigger so batch totals keep it
// transactionally synchronized whenever product_batches change.
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").unique(),
  barcode: text("barcode"),
  categoryId: integer("category_id").references(() => categories.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  description: text("description"),
  costPrice: integer("cost_price").notNull(),
  sellingPrice: integer("selling_price").notNull(),
  currency: text("currency").notNull().default("IQD"),
  stock: integer("stock").notNull().default(0),
  minStock: integer("min_stock").notNull().default(0),
  unit: text("unit").notNull().default("piece"),
  supplierId: integer("supplier_id").references(() => suppliers.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  trackExpiry: boolean("track_expiry").notNull().default(false),
  status: productStatusEnum("status").notNull().default("available"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_products_barcode").on(table.barcode),
  index("idx_products_category").on(table.categoryId),
  index("idx_products_supplier").on(table.supplierId),
  index("idx_products_status").on(table.status),
  index("idx_products_low_stock").on(table.isActive, table.stock, table.minStock),
  check("chk_products_cost_price_nonnegative", sql`${table.costPrice} >= 0`),
  check("chk_products_selling_price_nonnegative", sql`${table.sellingPrice} >= 0`),
  check("chk_products_stock_nonnegative", sql`${table.stock} >= 0`),
  check("chk_products_min_stock_nonnegative", sql`${table.minStock} >= 0`),
  check("chk_products_version_positive", sql`${table.version} >= 1`),
]);

export const productUnits = pgTable("product_units", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade", onUpdate: "cascade" }),
  unitName: text("unit_name").notNull(),
  factorToBase: integer("factor_to_base").notNull().default(1),
  barcode: text("barcode"),
  sellingPrice: integer("selling_price"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_product_units_product").on(table.productId),
  uniqueIndex("idx_product_units_unique").on(table.productId, table.unitName),
  check("chk_product_units_factor_positive", sql`${table.factorToBase} >= 1`),
  check(
    "chk_product_units_selling_price_nonnegative",
    sql`${table.sellingPrice} IS NULL OR ${table.sellingPrice} >= 0`,
  ),
]);

// Batch expiry is the only expiry source of truth. `date` is sufficient for
// FEFO/expiry-alert workflows and keeps indexes smaller than timestamps.
export const productBatches = pgTable("product_batches", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
  batchNumber: text("batch_number").notNull(),
  expiryDate: date("expiry_date", { mode: "string" }),
  manufacturingDate: date("manufacturing_date", { mode: "string" }),
  quantityReceived: integer("quantity_received").notNull(),
  quantityOnHand: integer("quantity_on_hand").notNull(),
  costPerUnit: integer("cost_per_unit"),
  purchaseId: integer("purchase_id").references(() => purchases.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  status: productBatchStatusEnum("status").notNull().default("active"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  version: integer("version").notNull().default(1),
}, (table) => [
  index("idx_batches_product").on(table.productId),
  index("idx_batches_expiry").on(table.expiryDate),
  index("idx_product_batches_product_expiry").on(table.productId, table.expiryDate),
  index("idx_product_batches_product_quantity").on(table.productId, table.quantityOnHand),
  uniqueIndex("idx_batches_unique").on(table.productId, table.batchNumber),
  check("chk_batches_qty_received_nonnegative", sql`${table.quantityReceived} >= 0`),
  check("chk_batches_qty_on_hand_nonnegative", sql`${table.quantityOnHand} >= 0`),
  check(
    "chk_batches_cost_per_unit_nonnegative",
    sql`${table.costPerUnit} IS NULL OR ${table.costPerUnit} >= 0`,
  ),
  check("chk_batches_version_positive", sql`${table.version} >= 1`),
  check(
    "chk_batches_expiry_after_manufacture",
    sql`${table.expiryDate} IS NULL OR ${table.manufacturingDate} IS NULL OR ${table.expiryDate} >= ${table.manufacturingDate}`,
  ),
]);

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull(),
  currency: text("currency").notNull().default("IQD"),
  exchangeRate: numeric("exchange_rate", {
    precision: 18,
    scale: 6,
    mode: "number",
  }).notNull().default(1),
  interestRate: numeric("interest_rate", {
    precision: 18,
    scale: 6,
    mode: "number",
  }).notNull().default(0),
  interestAmount: integer("interest_amount").notNull().default(0),
  paymentType: salePaymentTypeEnum("payment_type").notNull(),
  paymentMethod: salePaymentMethodEnum("payment_method").notNull().default("cash"),
  referenceNumber: text("reference_number"),
  paidAmount: integer("paid_amount").notNull().default(0),
  refundedAmount: integer("refunded_amount").notNull().default(0),
  remainingAmount: integer("remaining_amount").notNull().default(0),
  status: saleStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  idempotencyKey: text("idempotency_key"),
  printStatus: printStatusEnum("print_status").notNull().default("pending"),
  printedAt: timestamp("printed_at", { mode: "string" }),
  printError: text("print_error"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  uniqueIndex("idx_sales_idempotency").on(table.idempotencyKey),
  index("idx_sales_customer").on(table.customerId),
  index("idx_sales_status").on(table.status),
  index("idx_sales_created_at").on(table.createdAt),
  check("chk_sales_subtotal_nonnegative", sql`${table.subtotal} >= 0`),
  check("chk_sales_discount_nonnegative", sql`${table.discount} >= 0`),
  check("chk_sales_tax_nonnegative", sql`${table.tax} >= 0`),
  check("chk_sales_total_nonnegative", sql`${table.total} >= 0`),
  check("chk_sales_paid_nonnegative", sql`${table.paidAmount} >= 0`),
  check("chk_sales_refunded_nonnegative", sql`${table.refundedAmount} >= 0`),
  check("chk_sales_remaining_nonnegative", sql`${table.remainingAmount} >= 0`),
  check("chk_sales_exchange_rate_positive", sql`${table.exchangeRate} > 0`),
  check("chk_sales_interest_rate_nonnegative", sql`${table.interestRate} >= 0`),
  check("chk_sales_interest_amount_nonnegative", sql`${table.interestAmount} >= 0`),
]);

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade", onUpdate: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitName: text("unit_name").notNull().default("piece"),
  unitFactor: integer("unit_factor").notNull().default(1),
  quantityBase: integer("quantity_base"),
  batchId: integer("batch_id").references(() => productBatches.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  unitPrice: integer("unit_price").notNull(),
  discount: integer("discount").notNull().default(0),
  subtotal: integer("subtotal").notNull(),
  returnedQuantityBase: integer("returned_quantity_base").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_sale_items_sale").on(table.saleId),
  index("idx_sale_items_product").on(table.productId),
  index("idx_sale_items_batch").on(table.batchId),
  check("chk_sale_items_quantity_positive", sql`${table.quantity} > 0`),
  check("chk_sale_items_unit_factor_positive", sql`${table.unitFactor} >= 1`),
  check(
    "chk_sale_items_quantity_base_positive",
    sql`${table.quantityBase} IS NULL OR ${table.quantityBase} > 0`,
  ),
  check("chk_sale_items_unit_price_nonnegative", sql`${table.unitPrice} >= 0`),
  check("chk_sale_items_discount_nonnegative", sql`${table.discount} >= 0`),
  check("chk_sale_items_subtotal_nonnegative", sql`${table.subtotal} >= 0`),
  check(
    "chk_sale_items_returned_quantity_nonnegative",
    sql`${table.returnedQuantityBase} >= 0`,
  ),
]);

export const saleItemDepletions = pgTable("sale_item_depletions", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade", onUpdate: "cascade" }),
  saleItemId: integer("sale_item_id")
    .notNull()
    .references(() => saleItems.id, { onDelete: "cascade", onUpdate: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
  batchId: integer("batch_id")
    .notNull()
    .references(() => productBatches.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  quantityBase: integer("quantity_base").notNull(),
  costPerUnit: integer("cost_per_unit").notNull(),
  totalCost: integer("total_cost").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_sale_item_depletions_sale").on(table.saleId),
  index("idx_sale_item_depletions_item").on(table.saleItemId),
  index("idx_sale_item_depletions_batch").on(table.batchId),
  uniqueIndex("idx_sale_item_depletions_unique").on(table.saleItemId, table.batchId),
  check("chk_sale_item_depletions_quantity_positive", sql`${table.quantityBase} > 0`),
  check("chk_sale_item_depletions_cost_nonnegative", sql`${table.costPerUnit} >= 0`),
  check("chk_sale_item_depletions_total_nonnegative", sql`${table.totalCost} >= 0`),
]);

export const purchases = pgTable("purchases", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  tax: integer("tax").notNull().default(0),
  total: integer("total").notNull(),
  paidAmount: integer("paid_amount").notNull().default(0),
  remainingAmount: integer("remaining_amount").notNull().default(0),
  currency: text("currency").notNull().default("IQD"),
  exchangeRate: numeric("exchange_rate", {
    precision: 18,
    scale: 6,
    mode: "number",
  }).notNull().default(1),
  status: purchaseStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  receivedAt: timestamp("received_at", { mode: "string" }),
  idempotencyKey: text("idempotency_key"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_purchases_supplier").on(table.supplierId),
  index("idx_purchases_status").on(table.status),
  uniqueIndex("idx_purchases_invoice_supplier").on(table.invoiceNumber, table.supplierId),
  uniqueIndex("idx_purchases_idempotency").on(table.idempotencyKey),
  check("chk_purchases_subtotal_nonnegative", sql`${table.subtotal} >= 0`),
  check("chk_purchases_discount_nonnegative", sql`${table.discount} >= 0`),
  check("chk_purchases_tax_nonnegative", sql`${table.tax} >= 0`),
  check("chk_purchases_total_nonnegative", sql`${table.total} >= 0`),
  check("chk_purchases_paid_nonnegative", sql`${table.paidAmount} >= 0`),
  check("chk_purchases_remaining_nonnegative", sql`${table.remainingAmount} >= 0`),
  check("chk_purchases_exchange_rate_positive", sql`${table.exchangeRate} > 0`),
]);

export const purchaseItems = pgTable("purchase_items", {
  id: serial("id").primaryKey(),
  purchaseId: integer("purchase_id")
    .notNull()
    .references(() => purchases.id, { onDelete: "cascade", onUpdate: "cascade" }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
  productName: text("product_name").notNull(),
  unitName: text("unit_name").notNull().default("piece"),
  unitFactor: integer("unit_factor").notNull().default(1),
  quantity: integer("quantity").notNull(),
  quantityBase: integer("quantity_base").notNull(),
  unitCost: integer("unit_cost").notNull(),
  lineSubtotal: integer("line_subtotal").notNull(),
  discount: integer("discount").notNull().default(0),
  batchId: integer("batch_id").references(() => productBatches.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  expiryDate: date("expiry_date", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_purchase_items_purchase").on(table.purchaseId),
  index("idx_purchase_items_product").on(table.productId),
  index("idx_purchase_items_batch").on(table.batchId),
  check("chk_purchase_items_quantity_positive", sql`${table.quantity} > 0`),
  check("chk_purchase_items_unit_factor_positive", sql`${table.unitFactor} >= 1`),
  check("chk_purchase_items_quantity_base_positive", sql`${table.quantityBase} > 0`),
  check("chk_purchase_items_unit_cost_nonnegative", sql`${table.unitCost} >= 0`),
  check("chk_purchase_items_discount_nonnegative", sql`${table.discount} >= 0`),
  check("chk_purchase_items_line_subtotal_nonnegative", sql`${table.lineSubtotal} >= 0`),
]);

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").references(() => sales.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  purchaseId: integer("purchase_id").references(() => purchases.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  customerId: integer("customer_id").references(() => customers.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  supplierId: integer("supplier_id").references(() => suppliers.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("IQD"),
  exchangeRate: numeric("exchange_rate", {
    precision: 18,
    scale: 6,
    mode: "number",
  }).notNull().default(1),
  paymentMethod: paymentMethodEnum("payment_method").notNull(),
  referenceNumber: text("reference_number"),
  idempotencyKey: text("idempotency_key"),
  status: paymentStatusEnum("status").notNull().default("completed"),
  paymentDate: timestamp("payment_date", { mode: "string" }).defaultNow(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_payments_sale").on(table.saleId),
  index("idx_payments_purchase").on(table.purchaseId),
  index("idx_payments_customer").on(table.customerId),
  index("idx_payments_supplier").on(table.supplierId),
  uniqueIndex("idx_payments_idempotency").on(table.idempotencyKey),
  check("chk_payments_exchange_rate_positive", sql`${table.exchangeRate} > 0`),
  // Zero-value payments have no business meaning.
  check("chk_payments_amount_nonzero", sql`${table.amount} <> 0`),
  // A payment settles a sale OR a purchase — never both simultaneously.
  check(
    "chk_payments_no_sale_and_purchase",
    sql`NOT (${table.saleId} IS NOT NULL AND ${table.purchaseId} IS NOT NULL)`,
  ),
  // A payment belongs to a customer OR a supplier — never both simultaneously.
  check(
    "chk_payments_no_customer_and_supplier",
    sql`NOT (${table.customerId} IS NOT NULL AND ${table.supplierId} IS NOT NULL)`,
  ),
  // A sale-context payment must not reference a supplier (incoherent mix).
  check(
    "chk_payments_no_sale_and_supplier",
    sql`NOT (${table.saleId} IS NOT NULL AND ${table.supplierId} IS NOT NULL)`,
  ),
  // A purchase-context payment must not reference a customer (incoherent mix).
  check(
    "chk_payments_no_purchase_and_customer",
    sql`NOT (${table.purchaseId} IS NOT NULL AND ${table.customerId} IS NOT NULL)`,
  ),
  // Every payment must carry at least one traceable business context.
  check(
    "chk_payments_has_context",
    sql`(${table.saleId} IS NOT NULL OR ${table.purchaseId} IS NOT NULL OR ${table.customerId} IS NOT NULL OR ${table.supplierId} IS NOT NULL)`,
  ),
]);

export const paymentAllocations = pgTable("payment_allocations", {
  id: serial("id").primaryKey(),
  paymentId: integer("payment_id")
    .notNull()
    .references(() => payments.id, { onDelete: "cascade", onUpdate: "cascade" }),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id, { onDelete: "cascade", onUpdate: "cascade" }),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_payment_alloc_payment").on(table.paymentId),
  index("idx_payment_alloc_sale").on(table.saleId),
  check("chk_payment_allocations_amount_positive", sql`${table.amount} > 0`),
]);

export const inventoryMovements = pgTable("inventory_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
  batchId: integer("batch_id").references(() => productBatches.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  movementType: inventoryMovementTypeEnum("movement_type").notNull(),
  reason: inventoryMovementReasonEnum("reason").notNull(),
  quantityBase: integer("quantity_base").notNull(),
  unitName: text("unit_name").notNull().default("piece"),
  unitFactor: integer("unit_factor").notNull().default(1),
  stockBefore: integer("stock_before").notNull(),
  stockAfter: integer("stock_after").notNull(),
  costPerUnit: integer("cost_per_unit"),
  totalCost: integer("total_cost"),
  sourceType: text("source_type"),
  sourceId: integer("source_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_inv_mov_product").on(table.productId),
  index("idx_inv_mov_batch").on(table.batchId),
  index("idx_inv_mov_date").on(table.createdAt),
  index("idx_inventory_movements_product_created_at").on(table.productId, table.createdAt),
  index("idx_inv_mov_source").on(table.sourceType, table.sourceId),
  check("chk_inventory_movements_quantity_nonzero", sql`${table.quantityBase} <> 0`),
  check("chk_inventory_movements_unit_factor_positive", sql`${table.unitFactor} >= 1`),
  check(
    "chk_inventory_movements_cost_per_unit_nonnegative",
    sql`${table.costPerUnit} IS NULL OR ${table.costPerUnit} >= 0`,
  ),
  check(
    "chk_inventory_movements_total_cost_nonnegative",
    sql`${table.totalCost} IS NULL OR ${table.totalCost} >= 0`,
  ),
  check("chk_inventory_movements_stock_before_nonnegative", sql`${table.stockBefore} >= 0`),
  check("chk_inventory_movements_stock_after_nonnegative", sql`${table.stockAfter} >= 0`),
]);

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_departments_name").on(table.name),
  index("idx_departments_active").on(table.isActive),
]);

export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  salary: integer("salary").notNull(),
  position: text("position").notNull(),
  departmentId: integer("department_id")
    .notNull()
    .references(() => departments.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_employees_name").on(table.name),
  index("idx_employees_department").on(table.departmentId),
  index("idx_employees_active").on(table.isActive),
  check("chk_employees_salary_nonnegative", sql`${table.salary} >= 0`),
]);

export const payrollRuns = pgTable("payroll_runs", {
  id: serial("id").primaryKey(),
  periodYear: integer("period_year").notNull(),
  periodMonth: integer("period_month").notNull(),
  paymentDate: timestamp("payment_date", { mode: "string" }),
  status: payrollRunStatusEnum("status").notNull().default("draft"),
  totalGrossPay: integer("total_gross_pay").notNull().default(0),
  totalDeductions: integer("total_deductions").notNull().default(0),
  totalBonuses: integer("total_bonuses").notNull().default(0),
  totalNetPay: integer("total_net_pay").notNull().default(0),
  salaryExpenseAccountCode: text("salary_expense_account_code").notNull(),
  deductionsLiabilityAccountCode: text("deductions_liability_account_code").notNull(),
  paymentAccountCode: text("payment_account_code").notNull(),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  approvedAt: timestamp("approved_at", { mode: "string" }),
  approvedBy: integer("approved_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  uniqueIndex("idx_payroll_runs_period").on(table.periodYear, table.periodMonth),
  index("idx_payroll_runs_status").on(table.status),
  check("chk_payroll_runs_period_year", sql`${table.periodYear} BETWEEN 2000 AND 9999`),
  check("chk_payroll_runs_period_month", sql`${table.periodMonth} BETWEEN 1 AND 12`),
  check("chk_payroll_runs_gross_nonnegative", sql`${table.totalGrossPay} >= 0`),
  check("chk_payroll_runs_deductions_nonnegative", sql`${table.totalDeductions} >= 0`),
  check("chk_payroll_runs_bonuses_nonnegative", sql`${table.totalBonuses} >= 0`),
  check("chk_payroll_runs_net_nonnegative", sql`${table.totalNetPay} >= 0`),
  check(
    "chk_payroll_runs_totals_consistent",
    sql`${table.totalNetPay} = ${table.totalGrossPay} - ${table.totalDeductions} + ${table.totalBonuses}`,
  ),
]);

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  accountType: accountTypeEnum("account_type").notNull(),
  parentId: integer("parent_id").references((): AnyPgColumn => accounts.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  isSystem: boolean("is_system").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

export const postingBatches = pgTable("posting_batches", {
  id: serial("id").primaryKey(),
  periodType: postingBatchPeriodTypeEnum("period_type").notNull().default("day"),
  periodStart: date("period_start", { mode: "string" }).notNull(),
  periodEnd: date("period_end", { mode: "string" }).notNull(),
  entriesCount: integer("entries_count").notNull().default(0),
  totalAmount: integer("total_amount").notNull().default(0),
  status: postingBatchStatusEnum("status").notNull().default("posted"),
  postedAt: timestamp("posted_at", { mode: "string" }).notNull().defaultNow(),
  postedBy: integer("posted_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_posting_batches_period").on(table.periodType, table.periodStart, table.periodEnd),
  check("chk_posting_batches_entries_nonnegative", sql`${table.entriesCount} >= 0`),
  check("chk_posting_batches_total_nonnegative", sql`${table.totalAmount} >= 0`),
  check("chk_posting_batches_period_order", sql`${table.periodEnd} >= ${table.periodStart}`),
]);

export const journalEntries = pgTable("journal_entries", {
  id: serial("id").primaryKey(),
  entryNumber: text("entry_number").notNull().unique(),
  entryDate: timestamp("entry_date", { mode: "string" }).notNull().defaultNow(),
  description: text("description").notNull(),
  sourceType: journalSourceTypeEnum("source_type"),
  sourceId: integer("source_id"),
  isPosted: boolean("is_posted").notNull().default(false),
  isReversed: boolean("is_reversed").notNull().default(false),
  reversalOfId: integer("reversal_of_id").references((): AnyPgColumn => journalEntries.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  postingBatchId: integer("posting_batch_id").references(() => postingBatches.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  totalAmount: integer("total_amount").notNull(),
  currency: text("currency").notNull().default("IQD"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_journal_date").on(table.entryDate),
  index("idx_journal_source").on(table.sourceType, table.sourceId),
  index("idx_journal_posting_batch").on(table.postingBatchId),
  check("chk_journal_entries_total_nonnegative", sql`${table.totalAmount} >= 0`),
]);

export const reconciliations = pgTable("reconciliations", {
  id: serial("id").primaryKey(),
  type: reconciliationTypeEnum("type").notNull(),
  status: reconciliationStatusEnum("status").notNull().default("open"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_reconciliations_type").on(table.type),
  index("idx_reconciliations_status").on(table.status),
]);

export const journalLines = pgTable("journal_lines", {
  id: serial("id").primaryKey(),
  journalEntryId: integer("journal_entry_id")
    .notNull()
    .references(() => journalEntries.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  accountId: integer("account_id")
    .notNull()
    .references(() => accounts.id, { onDelete: "restrict", onUpdate: "cascade" }),
  partnerId: integer("partner_id"),
  debit: integer("debit").notNull().default(0),
  credit: integer("credit").notNull().default(0),
  balance: integer("balance").generatedAlwaysAs(
    sql`COALESCE("debit", 0) - COALESCE("credit", 0)`,
  ),
  description: text("description"),
  reconciled: boolean("reconciled").notNull().default(false),
  reconciliationId: integer("reconciliation_id").references(
    () => reconciliations.id,
    {
      onDelete: "set null",
      onUpdate: "cascade",
    },
  ),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_journal_lines_entry").on(table.journalEntryId),
  index("idx_journal_lines_account").on(table.accountId),
  index("idx_journal_lines_partner").on(table.partnerId),
  index("idx_journal_lines_reconciled").on(table.reconciled),
  index("idx_journal_lines_reconciliation").on(table.reconciliationId),
  check("chk_journal_lines_debit_nonnegative", sql`${table.debit} >= 0`),
  check("chk_journal_lines_credit_nonnegative", sql`${table.credit} >= 0`),
  check(
    "chk_journal_lines_exactly_one_side",
    sql`((${table.debit} > 0 AND ${table.credit} = 0) OR (${table.credit} > 0 AND ${table.debit} = 0))`,
  ),
]);

export const payrollRunItems = pgTable("payroll_run_items", {
  id: serial("id").primaryKey(),
  payrollRunId: integer("payroll_run_id")
    .notNull()
    .references(() => payrollRuns.id, { onDelete: "cascade", onUpdate: "cascade" }),
  employeeId: integer("employee_id")
    .notNull()
    .references(() => employees.id, { onDelete: "restrict", onUpdate: "cascade" }),
  employeeName: text("employee_name").notNull(),
  position: text("position").notNull(),
  departmentName: text("department_name").notNull(),
  grossPay: integer("gross_pay").notNull(),
  deductions: integer("deductions").notNull().default(0),
  bonuses: integer("bonuses").notNull().default(0),
  netPay: integer("net_pay").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_payroll_run_items_run").on(table.payrollRunId),
  index("idx_payroll_run_items_employee").on(table.employeeId),
  uniqueIndex("idx_payroll_run_items_unique").on(table.payrollRunId, table.employeeId),
  check("chk_payroll_run_items_gross_nonnegative", sql`${table.grossPay} >= 0`),
  check("chk_payroll_run_items_deductions_nonnegative", sql`${table.deductions} >= 0`),
  check("chk_payroll_run_items_bonuses_nonnegative", sql`${table.bonuses} >= 0`),
  check("chk_payroll_run_items_net_nonnegative", sql`${table.netPay} >= 0`),
  check(
    "chk_payroll_run_items_totals_consistent",
    sql`${table.netPay} = ${table.grossPay} - ${table.deductions} + ${table.bonuses}`,
  ),
]);

export const reconciliationLines = pgTable("reconciliation_lines", {
  id: serial("id").primaryKey(),
  reconciliationId: integer("reconciliation_id")
    .notNull()
    .references(() => reconciliations.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  journalEntryLineId: integer("journal_entry_line_id")
    .notNull()
    .references(() => journalLines.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  index("idx_recon_lines_reconciliation").on(table.reconciliationId),
  index("idx_recon_lines_journal_line").on(table.journalEntryLineId),
  check("chk_reconciliation_lines_amount_positive", sql`${table.amount} > 0`),
]);

export const customerLedger = pgTable("customer_ledger", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "restrict", onUpdate: "cascade" }),
  transactionType: text("transaction_type").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  saleId: integer("sale_id").references(() => sales.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  paymentId: integer("payment_id").references(() => payments.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_cust_ledger_customer").on(table.customerId),
  index("idx_cust_ledger_date").on(table.createdAt),
  index("idx_customer_ledger_customer_created_at").on(table.customerId, table.createdAt),
  check("chk_customer_ledger_amount_nonnegative", sql`${table.amount} >= 0`),
]);

export const supplierLedger = pgTable("supplier_ledger", {
  id: serial("id").primaryKey(),
  supplierId: integer("supplier_id")
    .notNull()
    .references(() => suppliers.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  transactionType: text("transaction_type").notNull(),
  amount: integer("amount").notNull(),
  balanceAfter: integer("balance_after").notNull(),
  purchaseId: integer("purchase_id").references(() => purchases.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  paymentId: integer("payment_id").references(() => payments.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  journalEntryId: integer("journal_entry_id").references(() => journalEntries.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_supp_ledger_supplier").on(table.supplierId),
  index("idx_supp_ledger_date").on(table.createdAt),
  index("idx_supplier_ledger_supplier_created_at").on(table.supplierId, table.createdAt),
  check("chk_supplier_ledger_amount_nonnegative", sql`${table.amount} >= 0`),
]);

export const barcodeTemplates = pgTable("barcode_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  barcodeType: barcodeTypeEnum("barcode_type").notNull().default("CODE128"),
  showPrice: boolean("show_price").notNull().default(true),
  showName: boolean("show_name").notNull().default(true),
  showBarcode: boolean("show_barcode").notNull().default(true),
  showExpiry: boolean("show_expiry").notNull().default(false),
  layoutJson: text("layout_json"),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
}, (table) => [
  check("chk_barcode_templates_width_positive", sql`${table.width} > 0`),
  check("chk_barcode_templates_height_positive", sql`${table.height} > 0`),
]);

export const barcodePrintJobs = pgTable("barcode_print_jobs", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => barcodeTemplates.id, {
      onDelete: "restrict",
      onUpdate: "cascade",
    }),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "restrict", onUpdate: "cascade" }),
  productName: text("product_name").notNull(),
  barcode: text("barcode"),
  price: integer("price"),
  expiryDate: date("expiry_date", { mode: "string" }),
  quantity: integer("quantity").notNull().default(1),
  status: barcodePrintJobStatusEnum("status").notNull().default("pending"),
  printedAt: timestamp("printed_at", { mode: "string" }),
  printError: text("print_error"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  index("idx_print_jobs_status").on(table.status),
  index("idx_print_jobs_product").on(table.productId),
  check("chk_barcode_print_jobs_quantity_positive", sql`${table.quantity} > 0`),
  check(
    "chk_barcode_print_jobs_price_nonnegative",
    sql`${table.price} IS NULL OR ${table.price} >= 0`,
  ),
]);

export const currencySettings = pgTable("currency_settings", {
  id: serial("id").primaryKey(),
  currencyCode: text("currency_code").notNull().unique(),
  currencyName: text("currency_name").notNull(),
  symbol: text("symbol").notNull(),
  exchangeRate: numeric("exchange_rate", {
    precision: 18,
    scale: 6,
    mode: "number",
  }).notNull(),
  isBaseCurrency: boolean("is_base_currency").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
}, (table) => [
  check("chk_currency_settings_exchange_rate_positive", sql`${table.exchangeRate} > 0`),
]);

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});

export const systemSettings = pgTable("system_settings", {
  id: serial("id").primaryKey(),
  companyName: text("company_name").notNull().default(""),
  companyAddress: text("company_address"),
  companyPhone: text("company_phone"),
  companyPhone2: text("company_phone2"),
  companyEmail: text("company_email"),
  companyTaxId: text("company_tax_id"),
  companyLogo: text("company_logo"),
  defaultCurrency: text("default_currency").notNull().default("IQD"),
  lowStockThreshold: integer("low_stock_threshold").notNull().default(5),
  accountingEnabled: boolean("accounting_enabled").notNull().default(false),
  purchasesEnabled: boolean("purchases_enabled").notNull().default(true),
  ledgersEnabled: boolean("ledgers_enabled").notNull().default(true),
  unitsEnabled: boolean("units_enabled").notNull().default(false),
  paymentsOnInvoicesEnabled: boolean("payments_on_invoices_enabled")
    .notNull()
    .default(true),
  expiryAlertDays: integer("expiry_alert_days").notNull().default(30),
  debtReminderCount: integer("debt_reminder_count").notNull().default(3),
  debtReminderIntervalDays: integer("debt_reminder_interval_days")
    .notNull()
    .default(7),
  setupWizardCompleted: boolean("setup_wizard_completed")
    .notNull()
    .default(false),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  check("chk_system_settings_low_stock_threshold_nonnegative", sql`${table.lowStockThreshold} >= 0`),
  check("chk_system_settings_expiry_alert_days_nonnegative", sql`${table.expiryAlertDays} >= 0`),
  check("chk_system_settings_debt_reminder_count_nonnegative", sql`${table.debtReminderCount} >= 0`),
  check(
    "chk_system_settings_debt_interval_nonnegative",
    sql`${table.debtReminderIntervalDays} >= 0`,
  ),
]);

export const accountingSettings = pgTable("accounting_settings", {
  id: serial("id").primaryKey(),
  taxEnabled: boolean("tax_enabled").notNull().default(false),
  defaultTaxRate: numeric("default_tax_rate", {
    precision: 18,
    scale: 6,
    mode: "number",
  }).notNull().default(0),
  taxRegistrationNumber: text("tax_registration_number"),
  fiscalYearStartMonth: integer("fiscal_year_start_month").notNull().default(1),
  fiscalYearStartDay: integer("fiscal_year_start_day").notNull().default(1),
  autoPosting: boolean("auto_posting").notNull().default(false),
  costMethod: accountingCostMethodEnum("cost_method").notNull().default("fifo"),
  currencyCode: text("currency_code").notNull().default("IQD"),
  usdExchangeRate: numeric("usd_exchange_rate", {
    precision: 18,
    scale: 6,
    mode: "number",
  }).notNull().default(1480),
  roundingMethod: accountingRoundingMethodEnum("rounding_method")
    .notNull()
    .default("round"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  check("chk_accounting_settings_default_tax_rate_nonnegative", sql`${table.defaultTaxRate} >= 0`),
  check("chk_accounting_settings_usd_rate_positive", sql`${table.usdExchangeRate} > 0`),
  check(
    "chk_accounting_settings_fiscal_month",
    sql`${table.fiscalYearStartMonth} BETWEEN 1 AND 12`,
  ),
  check(
    "chk_accounting_settings_fiscal_day",
    sql`${table.fiscalYearStartDay} BETWEEN 1 AND 31`,
  ),
]);

export const posSettings = pgTable("pos_settings", {
  id: serial("id").primaryKey(),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  invoiceTemplateId: text("invoice_template_id").notNull().default("default"),
  paperSize: posPaperSizeEnum("paper_size").notNull().default("thermal"),
  layoutDirection: posLayoutDirectionEnum("layout_direction")
    .notNull()
    .default("rtl"),
  showQr: boolean("show_qr").notNull().default(false),
  showBarcode: boolean("show_barcode").notNull().default(false),
  invoiceLogo: text("invoice_logo").notNull().default(""),
  invoiceFooterNotes: text("invoice_footer_notes").notNull().default(""),
  defaultPrinterName: text("default_printer_name"),
  receiptHeader: text("receipt_header"),
  receiptFooter: text("receipt_footer"),
  quickSaleEnabled: boolean("quick_sale_enabled").notNull().default(true),
  soundEnabled: boolean("sound_enabled").notNull().default(true),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
});

export const barcodeSettings = pgTable("barcode_settings", {
  id: serial("id").primaryKey(),
  defaultBarcodeType: barcodeTypeEnum("default_barcode_type")
    .notNull()
    .default("CODE128"),
  defaultWidth: integer("default_width").notNull().default(200),
  defaultHeight: integer("default_height").notNull().default(100),
  showPrice: boolean("show_price").notNull().default(true),
  showProductName: boolean("show_product_name").notNull().default(true),
  showExpiryDate: boolean("show_expiry_date").notNull().default(false),
  encoding: text("encoding").notNull().default("UTF-8"),
  printDpi: integer("print_dpi").notNull().default(203),
  labelWidthMm: integer("label_width_mm").notNull().default(50),
  labelHeightMm: integer("label_height_mm").notNull().default(30),
  marginTop: integer("margin_top").notNull().default(2),
  marginBottom: integer("margin_bottom").notNull().default(2),
  marginLeft: integer("margin_left").notNull().default(2),
  marginRight: integer("margin_right").notNull().default(2),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id, {
    onDelete: "set null",
    onUpdate: "cascade",
  }),
}, (table) => [
  check("chk_barcode_settings_default_width_positive", sql`${table.defaultWidth} > 0`),
  check("chk_barcode_settings_default_height_positive", sql`${table.defaultHeight} > 0`),
  check("chk_barcode_settings_print_dpi_positive", sql`${table.printDpi} > 0`),
  check("chk_barcode_settings_label_width_positive", sql`${table.labelWidthMm} > 0`),
  check("chk_barcode_settings_label_height_positive", sql`${table.labelHeightMm} > 0`),
  check("chk_barcode_settings_margin_top_nonnegative", sql`${table.marginTop} >= 0`),
  check("chk_barcode_settings_margin_bottom_nonnegative", sql`${table.marginBottom} >= 0`),
  check("chk_barcode_settings_margin_left_nonnegative", sql`${table.marginLeft} >= 0`),
  check("chk_barcode_settings_margin_right_nonnegative", sql`${table.marginRight} >= 0`),
]);

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "restrict", onUpdate: "cascade" }),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  timestamp: timestamp("timestamp", { mode: "string" }).notNull().defaultNow(),
  changedFields: text("changed_fields"),
  changeDescription: text("change_description"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
}, (table) => [
  index("idx_audit_logs_user").on(table.userId),
  index("idx_audit_logs_entity").on(table.entityType, table.entityId),
  index("idx_audit_logs_timestamp").on(table.timestamp),
]);

export const revokedTokens = pgTable(
  "revoked_tokens",
  {
    jti: uuid("jti").primaryKey(),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "date" })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
  },
  (table) => [index("idx_revoked_tokens_expires_at").on(table.expiresAt)],
);
