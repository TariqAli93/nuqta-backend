/**
 * Sales domain schemas.
 */
import { ErrorResponses, successEnvelope } from "./common.js";

const SaleItemSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    saleId: { type: "integer" },
    productId: { type: "integer" },
    productName: { type: "string" },
    quantity: { type: "integer" },
    unitName: { type: "string" },
    unitFactor: { type: "integer" },
    quantityBase: { type: "integer" },
    batchId: { type: "integer", nullable: true },
    unitPrice: { type: "integer" },
    discount: { type: "integer" },
    subtotal: { type: "integer" },
    cogs: { type: "integer", nullable: true },
    weightedAverageCost: { type: "integer", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const SaleSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    invoiceNumber: { type: "string" },
    customerId: { type: "integer", nullable: true },
    subtotal: { type: "integer" },
    discount: { type: "integer" },
    tax: { type: "integer" },
    total: { type: "integer" },
    currency: { type: "string" },
    exchangeRate: { type: "number" },
    interestRate: { type: "integer" },
    interestAmount: { type: "integer" },
    paymentType: { type: "string", enum: ["cash", "credit", "mixed"] },
    paidAmount: { type: "integer" },
    remainingAmount: { type: "integer" },
    status: { type: "string", enum: ["pending", "completed", "cancelled"] },
    notes: { type: "string", nullable: true },
    idempotencyKey: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", nullable: true, format: "date-time" },
    createdBy: { type: "integer", nullable: true },
    items: { type: "array", items: SaleItemSchema },
    cogs: { type: "integer", nullable: true },
    totalCogs: { type: "integer", nullable: true },
    profit: { type: "integer", nullable: true },
    marginBps: { type: "integer", nullable: true },
  },
};

const SaleListQuerySchema = {
  type: "object" as const,
  properties: {
    page: { type: "string", pattern: "^\\d+$" },
    limit: { type: "string", pattern: "^\\d+$" },
    startDate: {
      type: "string",
      format: "date",
      description: "Filter from date",
    },
    endDate: { type: "string", format: "date", description: "Filter to date" },
  },
} as const;

const CreateSaleItemSchema = {
  type: "object" as const,
  required: ["productId", "quantity", "unitPrice"],
  properties: {
    productId: { type: "integer", minimum: 1 },
    quantity: { type: "integer", minimum: 1 },
    unitPrice: { type: "integer", minimum: 0 },
    discount: { type: "integer", minimum: 0 },
    unitName: { type: "string" },
    unitFactor: { type: "integer", minimum: 1 },
    batchId: { type: "integer" },
  },
};

const CreateSaleBodySchema = {
  type: "object" as const,
  required: ["items", "paymentType"],
  properties: {
    items: { type: "array", items: CreateSaleItemSchema, minItems: 1 },
    customerId: { type: "integer" },
    discount: { type: "integer", minimum: 0 },
    tax: { type: "integer", minimum: 0 },
    paymentType: { type: "string", enum: ["cash", "credit", "mixed"] },
    paidAmount: { type: "integer", minimum: 0 },
    currency: { type: "string" },
    notes: { type: "string" },
    interestRate: { type: "integer" },
    interestRateBps: { type: "integer" },
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
    },
    referenceNumber: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

const AddSalePaymentBodySchema = {
  type: "object" as const,
  required: ["amount", "paymentMethod"],
  properties: {
    customerId: { type: "integer" },
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

export const getSalesSchema = {
  tags: ["Sales"],
  summary: "List sales",
  security: [{ bearerAuth: [] }],
  querystring: SaleListQuerySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          items: { type: "array" as const, items: SaleSchema },
          total: { type: "integer" },
          page: { type: "integer" },
          limit: { type: "integer" },
        },
      },
      "Paginated sales list",
    ),
    ...ErrorResponses,
  },
} as const;

export const getSaleByIdSchema = {
  tags: ["Sales"],
  summary: "Get sale by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(SaleSchema, "Sale details"),
    ...ErrorResponses,
  },
} as const;

export const createSaleSchema = {
  tags: ["Sales"],
  summary: "Create a sale",
  description: "Create a new sale with line items and payment information.",
  security: [{ bearerAuth: [] }],
  body: CreateSaleBodySchema,
  response: {
    200: successEnvelope(SaleSchema, "Created sale"),
    ...ErrorResponses,
  },
} as const;

export const addSalePaymentSchema = {
  tags: ["Sales"],
  summary: "Add payment to a sale",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  body: AddSalePaymentBodySchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Payment result"),
    ...ErrorResponses,
  },
} as const;
