const SaleReceiptStoreSchema = {
  type: "object" as const,
  required: [
    "companyName",
    "companyNameAr",
    "phone",
    "mobile",
    "address",
    "receiptWidth",
    "footerNote",
  ],
  properties: {
    companyName: { type: "string" },
    companyNameAr: { type: "string" },
    phone: { type: "string" },
    mobile: { type: "string" },
    address: { type: "string" },
    receiptWidth: { type: "string" },
    footerNote: { type: "string" },
  },
  additionalProperties: false,
};

const SaleReceiptPartySchema = {
  type: "object" as const,
  required: ["id", "name"],
  properties: {
    id: { type: "integer", nullable: true },
    name: { type: "string" },
    phone: { type: "string" },
  },
  additionalProperties: false,
};

const SaleReceiptBranchSchema = {
  type: "object" as const,
  required: ["id", "name"],
  properties: {
    id: { type: "integer", nullable: true },
    name: { type: "string" },
  },
  additionalProperties: false,
};

const SaleReceiptItemSchema = {
  type: "object" as const,
  required: [
    "productId",
    "productName",
    "quantity",
    "unitPrice",
    "subtotal",
    "discount",
    "tax",
  ],
  properties: {
    productId: { type: "integer", nullable: true },
    productName: { type: "string" },
    quantity: { type: "integer" },
    unitPrice: { type: "integer" },
    subtotal: { type: "integer" },
    discount: { type: "integer" },
    tax: { type: "integer" },
  },
  additionalProperties: false,
};

export const SaleReceiptSchema = {
  type: "object" as const,
  required: [
    "saleId",
    "invoiceNumber",
    "createdAt",
    "subtotal",
    "discount",
    "tax",
    "total",
    "currency",
    "customer",
    "cashier",
    "branch",
    "store",
    "items",
  ],
  properties: {
    saleId: { type: "integer" },
    invoiceNumber: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    subtotal: { type: "integer" },
    discount: { type: "integer" },
    tax: { type: "integer" },
    total: { type: "integer" },
    currency: { type: "string" },
    customer: SaleReceiptPartySchema,
    cashier: {
      type: "object" as const,
      required: ["id", "name"],
      properties: {
        id: { type: "integer", nullable: true },
        name: { type: "string" },
      },
      additionalProperties: false,
    },
    branch: SaleReceiptBranchSchema,
    store: SaleReceiptStoreSchema,
    items: {
      type: "array" as const,
      items: SaleReceiptItemSchema,
    },
    receiptText: { type: "string" },
  },
  additionalProperties: false,
};
