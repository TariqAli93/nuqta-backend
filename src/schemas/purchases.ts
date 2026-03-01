/**
 * Purchase domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
} from "./common.js";

const PurchaseItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    purchaseId: { type: "integer" },
    productId: { type: "integer" },
    productName: { type: "string" },
    unitName: { type: "string" },
    unitFactor: { type: "integer" },
    quantity: { type: "integer" },
    quantityBase: { type: "integer" },
    unitCost: { type: "integer" },
    lineSubtotal: { type: "integer" },
    discount: { type: "integer" },
    batchId: { type: "integer", nullable: true },
    batchNumber: { type: "string", nullable: true },
    expiryDate: { type: "string", nullable: true, format: "date-time" },
    createdAt: { type: "string", format: "date-time" },
  },
};

const PurchaseSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    invoiceNumber: { type: "string" },
    supplierId: { type: "integer" },
    subtotal: { type: "integer" },
    discount: { type: "integer" },
    tax: { type: "integer" },
    total: { type: "integer" },
    paidAmount: { type: "integer" },
    remainingAmount: { type: "integer" },
    currency: { type: "string" },
    exchangeRate: { type: "number" },
    status: {
      type: "string",
      enum: ["pending", "completed", "cancelled", "received", "partial"],
    },
    notes: { type: "string", nullable: true },
    receivedAt: { type: "string", nullable: true, format: "date-time" },
    idempotencyKey: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
    items: { type: "array", items: PurchaseItemSchema },
    payments: { type: "array", items: { type: "object" } },
  },
};

const PurchaseListQuerySchema = {
  type: "object" as const,
  properties: {
    search: { type: "string", description: "Search by invoice number" },
    status: {
      type: "string",
      enum: ["pending", "completed", "cancelled", "received", "partial"],
    },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const CreatePurchaseItemSchema = {
  type: "object" as const,
  required: ["productId", "quantity", "unitCost"],
  properties: {
    productId: { type: "integer", minimum: 1 },
    productName: { type: "string" },
    unitName: { type: "string" },
    unitFactor: { type: "integer", minimum: 1 },
    quantity: { type: "integer", minimum: 1 },
    quantityBase: { type: "integer", minimum: 1 },
    unitCost: { type: "integer", minimum: 0 },
    lineSubtotal: { type: "integer", minimum: 0 },
    discount: { type: "integer", minimum: 0 },
    batchId: { type: "integer" },
    batchNumber: { type: "string" },
    expiryDate: { type: "string", format: "date-time" },
  },
};

const CreatePurchaseBodySchema = {
  type: "object" as const,
  required: ["invoiceNumber", "supplierId", "items"],
  properties: {
    invoiceNumber: { type: "string", minLength: 1 },
    supplierId: { type: "integer", minimum: 1 },
    items: { type: "array", items: CreatePurchaseItemSchema, minItems: 1 },
    discount: { type: "integer", minimum: 0 },
    tax: { type: "integer", minimum: 0 },
    paidAmount: { type: "integer", minimum: 0 },
    currency: { type: "string" },
    notes: { type: "string" },
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
    },
    referenceNumber: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

const AddPurchasePaymentBodySchema = {
  type: "object" as const,
  required: ["amount", "paymentMethod"],
  properties: {
    supplierId: { type: "integer" },
    amount: { type: "integer", minimum: 1 },
    currency: { type: "string" },
    exchangeRate: { type: "number" },
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
    },
    referenceNumber: { type: "string" },
    notes: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

export const getPurchasesSchema = {
  tags: ["Purchases"],
  summary: "List purchases",
  security: [{ bearerAuth: [] }],
  querystring: PurchaseListQuerySchema,
  response: {
    200: successArrayEnvelope(PurchaseSchema, "List of purchases"),
    ...ErrorResponses,
  },
} as const;

export const getPurchaseByIdSchema = {
  tags: ["Purchases"],
  summary: "Get purchase by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(PurchaseSchema, "Purchase details"),
    ...ErrorResponses,
  },
} as const;

export const createPurchaseSchema = {
  tags: ["Purchases"],
  summary: "Create a purchase",
  description: "Create a new purchase order with line items.",
  security: [{ bearerAuth: [] }],
  body: CreatePurchaseBodySchema,
  response: {
    200: successEnvelope(PurchaseSchema, "Created purchase"),
    ...ErrorResponses,
  },
} as const;

export const addPurchasePaymentSchema = {
  tags: ["Purchases"],
  summary: "Add payment to a purchase",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: AddPurchasePaymentBodySchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Payment result"),
    ...ErrorResponses,
  },
} as const;
