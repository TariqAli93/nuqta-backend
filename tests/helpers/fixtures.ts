export const timestamp = "2026-03-01T10:00:00.000Z";
export const dateOnly = "2026-03-01";

export const authPayload = {
  sub: 1,
  role: "admin",
  permissions: ["users:read", "users:update", "products:read"],
};

export const user = {
  id: 1,
  username: "admin",
  fullName: "Admin User",
  phone: "7700000000",
  role: "admin",
  isActive: true,
  lastLoginAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp,
};

export const category = {
  id: 2,
  name: "Beverages",
  description: "Hot drinks",
  isActive: true,
  createdAt: timestamp,
  createdBy: 1,
};

export const customer = {
  id: 3,
  name: "Layla Hassan",
  phone: "7711111111",
  address: "Baghdad",
  city: "Baghdad",
  notes: "Preferred account",
  totalPurchases: 20000,
  totalDebt: 5000,
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: 1,
};

export const employee = {
  id: 13,
  name: "Sara Ali",
  salary: 1500000,
  position: "Accountant",
  department: "Finance",
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: 1,
};

export const supplier = {
  id: 4,
  name: "Nuqta Supplies",
  phone: "7722222222",
  phone2: "7733333333",
  address: "Karrada",
  city: "Baghdad",
  notes: "Primary supplier",
  openingBalance: 0,
  currentBalance: 10000,
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: 1,
};

export const product = {
  id: 5,
  name: "Arabica Coffee",
  sku: "COF-001",
  barcode: "1234567890123",
  categoryId: category.id,
  description: "Premium coffee beans",
  costPrice: 7000,
  sellingPrice: 10000,
  currency: "IQD",
  stock: 25,
  minStock: 5,
  unit: "bag",
  supplier: supplier.name,
  supplierId: supplier.id,
  expireDate: timestamp,
  isExpire: false,
  status: "available",
  isActive: true,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: 1,
};

export const productList = {
  items: [product],
  total: 1,
  page: 1,
  limit: 20,
};

export const saleItem = {
  id: 1,
  saleId: 11,
  productId: product.id,
  productName: product.name,
  quantity: 2,
  unitName: "bag",
  unitFactor: 1,
  quantityBase: 2,
  batchId: 8,
  unitPrice: 10000,
  discount: 0,
  subtotal: 20000,
  cogs: 14000,
  weightedAverageCost: 7000,
  createdAt: timestamp,
};

export const sale = {
  id: 11,
  invoiceNumber: "SAL-001",
  customerId: customer.id,
  subtotal: 20000,
  discount: 0,
  tax: 0,
  total: 20000,
  currency: "IQD",
  exchangeRate: 1,
  interestRate: 0,
  interestAmount: 0,
  paymentType: "cash",
  paidAmount: 20000,
  remainingAmount: 0,
  status: "completed",
  notes: "Counter sale",
  idempotencyKey: "sale-1",
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: 1,
  items: [saleItem],
  cogs: 14000,
  totalCogs: 14000,
  profit: 6000,
  marginBps: 3000,
};

export const saleList = {
  items: [sale],
  total: 1,
  page: 1,
  limit: 20,
};

export const purchaseItem = {
  id: 1,
  purchaseId: 21,
  productId: product.id,
  productName: product.name,
  unitName: "bag",
  unitFactor: 1,
  quantity: 5,
  quantityBase: 5,
  unitCost: 7000,
  lineSubtotal: 35000,
  discount: 0,
  batchId: 8,
  batchNumber: "BATCH-001",
  expiryDate: timestamp,
  createdAt: timestamp,
};

export const purchase = {
  id: 21,
  invoiceNumber: "PUR-001",
  supplierId: supplier.id,
  subtotal: 35000,
  discount: 0,
  tax: 0,
  total: 35000,
  paidAmount: 10000,
  remainingAmount: 25000,
  currency: "IQD",
  exchangeRate: 1,
  status: "received",
  notes: "Morning delivery",
  receivedAt: timestamp,
  idempotencyKey: "purchase-1",
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: 1,
  items: [purchaseItem],
  payments: [{ id: 2, amount: 10000 }],
};

export const companySettings = {
  name: "Nuqta Store",
  address: "Main Street",
  phone: "7700001111",
  phone2: "7700002222",
  email: "store@example.com",
  taxId: "TAX-1",
  logo: "logo.png",
  currency: "IQD",
  lowStockThreshold: 5,
};

export const currencySettings = {
  id: 1,
  currencyCode: "IQD",
  currencyName: "Iraqi Dinar",
  symbol: "IQD",
  exchangeRate: 1,
  isBaseCurrency: true,
  isActive: true,
  updatedAt: timestamp,
};

export const moduleSettings = {
  accountingEnabled: true,
  purchasesEnabled: true,
  ledgersEnabled: true,
  unitsEnabled: true,
  paymentsOnInvoicesEnabled: true,
};

export const dashboardStats = {
  salesToday: {
    revenue: 20000,
    count: 2,
    cash: 15000,
    card: 5000,
    transfer: 0,
  },
  lowStockCount: 3,
  topProducts: [
    {
      productId: 5,
      productName: "Arabica Coffee",
      quantity: 10,
      revenue: 100000,
    },
  ],
};

export const inventoryMovement = {
  id: 31,
  productId: product.id,
  batchId: 8,
  movementType: "in",
  reason: "purchase",
  quantityBase: 5,
  unitName: "bag",
  unitFactor: 1,
  stockBefore: 20,
  stockAfter: 25,
  costPerUnit: 7000,
  totalCost: 35000,
  sourceType: "purchase",
  sourceId: purchase.id,
  notes: "Receiving stock",
  createdAt: timestamp,
  createdBy: 1,
};

export const inventoryDashboard = {
  lowStock: 3,
  expiringSoon: 1,
  totalProducts: 42,
};

export const expiryAlert = {
  productId: product.id,
  productName: product.name,
  expireDate: timestamp,
  daysRemaining: 10,
};

export const postingBatch = {
  id: 41,
  periodType: "month",
  periodStart: timestamp,
  periodEnd: timestamp,
  entriesCount: 4,
  totalAmount: 45000,
  status: "posted",
  postedAt: timestamp,
  postedBy: 1,
  notes: "Month close",
  createdAt: timestamp,
};

export const supplierLedger = {
  items: [
    {
      id: 51,
      supplierId: supplier.id,
      transactionType: "invoice",
      amount: 35000,
      balanceAfter: 35000,
      purchaseId: purchase.id,
      paymentId: null,
      journalEntryId: null,
      notes: "Purchase invoice",
      createdAt: timestamp,
      createdBy: 1,
    },
  ],
  total: 1,
};

export const customerLedger = {
  items: [
    {
      id: 61,
      customerId: customer.id,
      transactionType: "invoice",
      amount: 20000,
      balanceAfter: 20000,
      saleId: sale.id,
      paymentId: null,
      journalEntryId: null,
      notes: "Sale invoice",
      createdAt: timestamp,
      createdBy: 1,
    },
  ],
  total: 1,
};

export const account = {
  id: 71,
  code: "1000",
  name: "Cash",
  nameAr: null,
  accountType: "asset",
  parentId: null,
  isSystem: true,
  isActive: true,
  balance: 200000,
  createdAt: timestamp,
};

export const journalEntry = {
  id: 81,
  entryNumber: "JE-001",
  entryDate: timestamp,
  description: "Sale entry",
  sourceType: "sale",
  sourceId: sale.id,
  isPosted: true,
  isReversed: false,
  reversalOfId: null,
  postingBatchId: postingBatch.id,
  totalAmount: 20000,
  currency: "IQD",
  notes: "Generated from sale",
  createdAt: timestamp,
  createdBy: 1,
  lines: [
    {
      id: 1,
      journalEntryId: 81,
      accountId: account.id,
      debit: 20000,
      credit: 0,
      description: "Cash",
      createdAt: timestamp,
    },
  ],
};

export const trialBalanceRow = {
  accountId: account.id,
  accountCode: account.code,
  accountName: account.name,
  accountType: account.accountType,
  debit: 20000,
  credit: 0,
  balance: 20000,
};

export const accountingStatus = {
  isInitialized: true,
  accountCount: 12,
};

export const payrollRun = {
  id: 101,
  periodYear: 2026,
  periodMonth: 3,
  paymentDate: timestamp,
  status: "draft",
  totalGrossPay: 1500000,
  totalDeductions: 50000,
  totalBonuses: 100000,
  totalNetPay: 1550000,
  salaryExpenseAccountCode: "5002",
  deductionsLiabilityAccountCode: "2101",
  paymentAccountCode: "1001",
  journalEntryId: null,
  notes: "March payroll",
  createdAt: timestamp,
  createdBy: 1,
  approvedAt: null,
  approvedBy: null,
  items: [
    {
      id: 1,
      payrollRunId: 101,
      employeeId: employee.id,
      employeeName: employee.name,
      position: employee.position,
      department: employee.department,
      grossPay: employee.salary,
      deductions: 50000,
      bonuses: 100000,
      netPay: 1550000,
      notes: "Overtime",
      createdAt: timestamp,
    },
  ],
};

export const paymentResult = {
  id: 91,
  amount: 10000,
  status: "recorded",
};

export const genericOperationResult = {
  updated: true,
};
