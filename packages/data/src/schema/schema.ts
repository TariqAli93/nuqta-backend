import {
  pgTable,
  text,
  integer,
  real,
  serial,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ═══════════════════════════════════════════════════════════════
// USERS
// ═══════════════════════════════════════════════════════════════

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  phone: text("phone"),
  role: text("role").notNull().default("cashier"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at", { mode: "string" }),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// CUSTOMERS
// ═══════════════════════════════════════════════════════════════

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  totalPurchases: integer("total_purchases").default(0),
  totalDebt: integer("total_debt").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by"),
});

// ═══════════════════════════════════════════════════════════════
// SUPPLIERS
// ═══════════════════════════════════════════════════════════════

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone"),
  phone2: text("phone2"),
  address: text("address"),
  city: text("city"),
  notes: text("notes"),
  openingBalance: integer("opening_balance").default(0),
  currentBalance: integer("current_balance").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by"),
});

// ═══════════════════════════════════════════════════════════════
// CATEGORIES
// ═══════════════════════════════════════════════════════════════

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by"),
});

// ═══════════════════════════════════════════════════════════════
// PRODUCTS
// ═══════════════════════════════════════════════════════════════

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  sku: text("sku").unique(),
  barcode: text("barcode"),
  categoryId: integer("category_id"),
  description: text("description"),
  costPrice: integer("cost_price").notNull(),
  sellingPrice: integer("selling_price").notNull(),
  currency: text("currency").notNull().default("IQD"),
  stock: integer("stock").default(0),
  minStock: integer("min_stock").default(0),
  unit: text("unit").default("piece"),
  supplier: text("supplier"),
  supplierId: integer("supplier_id"),
  expireDate: timestamp("expire_date", { mode: "string" }),
  isExpire: boolean("is_expire").default(false),
  status: text("status").notNull().default("available"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by"),
});

// ═══════════════════════════════════════════════════════════════
// PRODUCT UNITS (Packaging / Conversion)
// ═══════════════════════════════════════════════════════════════

export const productUnits = pgTable(
  "product_units",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    unitName: text("unit_name").notNull(),
    factorToBase: integer("factor_to_base").notNull().default(1),
    barcode: text("barcode"),
    sellingPrice: integer("selling_price"),
    isDefault: boolean("is_default").default(false),
    isActive: boolean("is_active").default(true),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_product_units_product").on(table.productId),
    uniqueIndex("idx_product_units_unique").on(table.productId, table.unitName),
  ],
);

// ═══════════════════════════════════════════════════════════════
// PRODUCT BATCHES (Batch/Expiry Tracking — Killer Feature 1)
// ═══════════════════════════════════════════════════════════════

export const productBatches = pgTable(
  "product_batches",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    batchNumber: text("batch_number").notNull(),
    expiryDate: timestamp("expiry_date", { mode: "string" }),
    manufacturingDate: timestamp("manufacturing_date", { mode: "string" }),
    quantityReceived: integer("quantity_received").notNull(),
    quantityOnHand: integer("quantity_on_hand").notNull(),
    costPerUnit: integer("cost_per_unit"),
    purchaseId: integer("purchase_id"),
    status: text("status").notNull().default("active"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_batches_product").on(table.productId),
    index("idx_batches_expiry").on(table.expiryDate),
    uniqueIndex("idx_batches_unique").on(table.productId, table.batchNumber),
  ],
);

// ═══════════════════════════════════════════════════════════════
// SALES
// ═══════════════════════════════════════════════════════════════

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  invoiceNumber: text("invoice_number").notNull().unique(),
  customerId: integer("customer_id"),
  subtotal: integer("subtotal").notNull(),
  discount: integer("discount").default(0),
  tax: integer("tax").default(0),
  total: integer("total").notNull(),
  currency: text("currency").notNull().default("IQD"),
  exchangeRate: real("exchange_rate").default(1),
  interestRate: real("interest_rate").default(0),
  interestAmount: integer("interest_amount").default(0),
  paymentType: text("payment_type").notNull(),
  paidAmount: integer("paid_amount").default(0),
  remainingAmount: integer("remaining_amount").default(0),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  idempotencyKey: text("idempotency_key").unique(),
  printStatus: text("print_status").notNull().default("pending"),
  printedAt: timestamp("printed_at", { mode: "string" }),
  printError: text("print_error"),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  createdBy: integer("created_by"),
});

// ═══════════════════════════════════════════════════════════════
// SALE ITEMS
// ═══════════════════════════════════════════════════════════════

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id"),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitName: text("unit_name").default("piece"),
  unitFactor: integer("unit_factor").default(1),
  quantityBase: integer("quantity_base"),
  batchId: integer("batch_id"),
  unitPrice: integer("unit_price").notNull(),
  discount: integer("discount").default(0),
  subtotal: integer("subtotal").notNull(),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// SALE ITEM DEPLETIONS (FIFO batch traceability per sold line)
// ═══════════════════════════════════════════════════════════════

export const saleItemDepletions = pgTable(
  "sale_item_depletions",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id").notNull(),
    saleItemId: integer("sale_item_id").notNull(),
    productId: integer("product_id").notNull(),
    batchId: integer("batch_id").notNull(),
    quantityBase: integer("quantity_base").notNull(),
    costPerUnit: integer("cost_per_unit").notNull(),
    totalCost: integer("total_cost").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_sale_item_depletions_sale").on(table.saleId),
    index("idx_sale_item_depletions_item").on(table.saleItemId),
    index("idx_sale_item_depletions_batch").on(table.batchId),
    uniqueIndex("idx_sale_item_depletions_unique").on(
      table.saleItemId,
      table.batchId,
    ),
  ],
);

// ═══════════════════════════════════════════════════════════════
// PURCHASES (Procurement Invoices)
// ═══════════════════════════════════════════════════════════════

export const purchases = pgTable(
  "purchases",
  {
    id: serial("id").primaryKey(),
    invoiceNumber: text("invoice_number").notNull(),
    supplierId: integer("supplier_id").notNull(),
    subtotal: integer("subtotal").notNull(),
    discount: integer("discount").default(0),
    tax: integer("tax").default(0),
    total: integer("total").notNull(),
    paidAmount: integer("paid_amount").default(0),
    remainingAmount: integer("remaining_amount").default(0),
    currency: text("currency").notNull().default("IQD"),
    exchangeRate: real("exchange_rate").default(1),
    status: text("status").notNull().default("pending"),
    notes: text("notes"),
    receivedAt: timestamp("received_at", { mode: "string" }),
    idempotencyKey: text("idempotency_key"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
    createdBy: integer("created_by"),
  },
  (table) => [
    index("idx_purchases_supplier").on(table.supplierId),
    uniqueIndex("idx_purchases_invoice_supplier").on(
      table.invoiceNumber,
      table.supplierId,
    ),
    uniqueIndex("idx_purchases_idempotency").on(table.idempotencyKey),
  ],
);

// ═══════════════════════════════════════════════════════════════
// PURCHASE ITEMS
// ═══════════════════════════════════════════════════════════════

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: serial("id").primaryKey(),
    purchaseId: integer("purchase_id").notNull(),
    productId: integer("product_id").notNull(),
    productName: text("product_name").notNull(),
    unitName: text("unit_name").default("piece"),
    unitFactor: integer("unit_factor").default(1),
    quantity: integer("quantity").notNull(),
    quantityBase: integer("quantity_base").notNull(),
    unitCost: integer("unit_cost").notNull(),
    lineSubtotal: integer("line_subtotal").notNull(),
    discount: integer("discount").default(0),
    batchId: integer("batch_id"),
    expiryDate: timestamp("expiry_date", { mode: "string" }),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_purchase_items_purchase").on(table.purchaseId),
    index("idx_purchase_items_product").on(table.productId),
  ],
);

// ═══════════════════════════════════════════════════════════════
// PAYMENTS
// ═══════════════════════════════════════════════════════════════

export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    saleId: integer("sale_id"),
    purchaseId: integer("purchase_id"),
    customerId: integer("customer_id"),
    supplierId: integer("supplier_id"),
    amount: integer("amount").notNull(),
    currency: text("currency").notNull().default("IQD"),
    exchangeRate: real("exchange_rate").default(1),
    paymentMethod: text("payment_method").notNull(),
    referenceNumber: text("reference_number"),
    idempotencyKey: text("idempotency_key"),
    status: text("status").notNull().default("completed"),
    paymentDate: timestamp("payment_date", { mode: "string" }).defaultNow(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    createdBy: integer("created_by"),
  },
  (table) => [
    index("idx_payments_sale").on(table.saleId),
    index("idx_payments_purchase").on(table.purchaseId),
    index("idx_payments_customer").on(table.customerId),
    index("idx_payments_supplier").on(table.supplierId),
    uniqueIndex("idx_payments_idempotency").on(table.idempotencyKey),
  ],
);

// ═══════════════════════════════════════════════════════════════
// INVENTORY MOVEMENTS (Stock Ledger)
// ═══════════════════════════════════════════════════════════════

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: serial("id").primaryKey(),
    productId: integer("product_id").notNull(),
    batchId: integer("batch_id"),
    movementType: text("movement_type").notNull(),
    reason: text("reason").notNull(),
    quantityBase: integer("quantity_base").notNull(),
    unitName: text("unit_name").default("piece"),
    unitFactor: integer("unit_factor").default(1),
    stockBefore: integer("stock_before").notNull(),
    stockAfter: integer("stock_after").notNull(),
    costPerUnit: integer("cost_per_unit"),
    totalCost: integer("total_cost"),
    sourceType: text("source_type"),
    sourceId: integer("source_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    createdBy: integer("created_by"),
  },
  (table) => [
    index("idx_inv_mov_product").on(table.productId),
    index("idx_inv_mov_batch").on(table.batchId),
    index("idx_inv_mov_date").on(table.createdAt),
    index("idx_inv_mov_source").on(table.sourceType, table.sourceId),
  ],
);

// ═══════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS (Double-Entry Accounting)
// ═══════════════════════════════════════════════════════════════

export const accounts = pgTable("accounts", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  accountType: text("account_type").notNull(),
  parentId: integer("parent_id"),
  isSystem: boolean("is_system").default(false),
  isActive: boolean("is_active").default(true),
  balance: integer("balance").default(0),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// POSTING BATCHES (Batch posting of journal entries)
// ═══════════════════════════════════════════════════════════════

export const postingBatches = pgTable(
  "posting_batches",
  {
    id: serial("id").primaryKey(),
    periodType: text("period_type").notNull().default("day"),
    periodStart: text("period_start").notNull(),
    periodEnd: text("period_end").notNull(),
    entriesCount: integer("entries_count").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    status: text("status").notNull().default("posted"),
    postedAt: timestamp("posted_at", { mode: "string" }).notNull().defaultNow(),
    postedBy: integer("posted_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_posting_batches_period").on(
      table.periodType,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

// ═══════════════════════════════════════════════════════════════
// JOURNAL ENTRIES (Header)
// ═══════════════════════════════════════════════════════════════

export const journalEntries = pgTable(
  "journal_entries",
  {
    id: serial("id").primaryKey(),
    entryNumber: text("entry_number").notNull().unique(),
    entryDate: timestamp("entry_date", { mode: "string" }).notNull().defaultNow(),
    description: text("description").notNull(),
    sourceType: text("source_type"),
    sourceId: integer("source_id"),
    isPosted: boolean("is_posted").default(false),
    isReversed: boolean("is_reversed").default(false),
    reversalOfId: integer("reversal_of_id"),
    postingBatchId: integer("posting_batch_id"),
    totalAmount: integer("total_amount").notNull(),
    currency: text("currency").notNull().default("IQD"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    createdBy: integer("created_by"),
  },
  (table) => [
    index("idx_journal_date").on(table.entryDate),
    index("idx_journal_source").on(table.sourceType, table.sourceId),
  ],
);

// ═══════════════════════════════════════════════════════════════
// JOURNAL LINES (Debit/Credit)
// ═══════════════════════════════════════════════════════════════

export const journalLines = pgTable(
  "journal_lines",
  {
    id: serial("id").primaryKey(),
    journalEntryId: integer("journal_entry_id").notNull(),
    accountId: integer("account_id").notNull(),
    debit: integer("debit").default(0),
    credit: integer("credit").default(0),
    description: text("description"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
  },
  (table) => [
    index("idx_journal_lines_entry").on(table.journalEntryId),
    index("idx_journal_lines_account").on(table.accountId),
  ],
);

// ═══════════════════════════════════════════════════════════════
// CUSTOMER LEDGER (Accounts Receivable)
// ═══════════════════════════════════════════════════════════════

export const customerLedger = pgTable(
  "customer_ledger",
  {
    id: serial("id").primaryKey(),
    customerId: integer("customer_id").notNull(),
    transactionType: text("transaction_type").notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    saleId: integer("sale_id"),
    paymentId: integer("payment_id"),
    journalEntryId: integer("journal_entry_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    createdBy: integer("created_by"),
  },
  (table) => [
    index("idx_cust_ledger_customer").on(table.customerId),
    index("idx_cust_ledger_date").on(table.createdAt),
  ],
);

// ═══════════════════════════════════════════════════════════════
// SUPPLIER LEDGER (Accounts Payable)
// ═══════════════════════════════════════════════════════════════

export const supplierLedger = pgTable(
  "supplier_ledger",
  {
    id: serial("id").primaryKey(),
    supplierId: integer("supplier_id").notNull(),
    transactionType: text("transaction_type").notNull(),
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    purchaseId: integer("purchase_id"),
    paymentId: integer("payment_id"),
    journalEntryId: integer("journal_entry_id"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    createdBy: integer("created_by"),
  },
  (table) => [
    index("idx_supp_ledger_supplier").on(table.supplierId),
    index("idx_supp_ledger_date").on(table.createdAt),
  ],
);

// ═══════════════════════════════════════════════════════════════
// BARCODE TEMPLATES (Killer Feature 2)
// ═══════════════════════════════════════════════════════════════

export const barcodeTemplates = pgTable("barcode_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  barcodeType: text("barcode_type").notNull().default("CODE128"),
  showPrice: boolean("show_price").default(true),
  showName: boolean("show_name").default(true),
  showBarcode: boolean("show_barcode").default(true),
  showExpiry: boolean("show_expiry").default(false),
  layoutJson: text("layout_json"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
});

// ═══════════════════════════════════════════════════════════════
// BARCODE PRINT JOBS (Killer Feature 2)
// ═══════════════════════════════════════════════════════════════

export const barcodePrintJobs = pgTable(
  "barcode_print_jobs",
  {
    id: serial("id").primaryKey(),
    templateId: integer("template_id").notNull(),
    productId: integer("product_id").notNull(),
    productName: text("product_name").notNull(),
    barcode: text("barcode"),
    price: integer("price"),
    expiryDate: timestamp("expiry_date", { mode: "string" }),
    quantity: integer("quantity").notNull().default(1),
    status: text("status").notNull().default("pending"),
    printedAt: timestamp("printed_at", { mode: "string" }),
    printError: text("print_error"),
    createdAt: timestamp("created_at", { mode: "string" }).defaultNow(),
    createdBy: integer("created_by"),
  },
  (table) => [
    index("idx_print_jobs_status").on(table.status),
    index("idx_print_jobs_product").on(table.productId),
  ],
);

// ═══════════════════════════════════════════════════════════════
// SETTINGS
// ═══════════════════════════════════════════════════════════════

export const currencySettings = pgTable("currency_settings", {
  id: serial("id").primaryKey(),
  currencyCode: text("currency_code").notNull().unique(),
  currencyName: text("currency_name").notNull(),
  symbol: text("symbol").notNull(),
  exchangeRate: real("exchange_rate").notNull(),
  isBaseCurrency: boolean("is_base_currency").default(false),
  isActive: boolean("is_active").default(true),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at", { mode: "string" }).defaultNow(),
  updatedBy: integer("updated_by"),
});

// ═══════════════════════════════════════════════════════════════
// AUDIT LOGS
// ═══════════════════════════════════════════════════════════════

export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: integer("entity_id").notNull(),
  timestamp: timestamp("timestamp", { mode: "string" }).notNull().defaultNow(),
  changedFields: text("changed_fields"),
  changeDescription: text("change_description"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  metadata: text("metadata"),
});
