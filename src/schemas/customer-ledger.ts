/**
 * Customer ledger domain schemas.
 */
import { ErrorResponses, successEnvelope } from "./common.js";

const CustomerLedgerEntrySchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    customerId: { type: "integer" },
    transactionType: {
      type: "string",
      enum: ["invoice", "payment", "return", "adjustment", "opening"],
    },
    amount: { type: "integer" },
    balanceAfter: { type: "integer" },
    saleId: { type: "integer", nullable: true },
    paymentId: { type: "integer", nullable: true },
    journalEntryId: { type: "integer", nullable: true },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const CustomerIdParamsSchema = {
  type: "object" as const,
  required: ["customerId"],
  properties: {
    customerId: {
      type: "string",
      pattern: "^\\d+$",
      description: "Customer ID",
    },
  },
} as const;

const LedgerQuerySchema = {
  type: "object" as const,
  properties: {
    dateFrom: { type: "string", format: "date" },
    dateTo: { type: "string", format: "date" },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const CustomerPaymentBodySchema = {
  type: "object" as const,
  required: ["amount", "paymentMethod"],
  properties: {
    amount: { type: "number", minimum: 0.01, description: "Payment amount" },
    paymentMethod: {
      type: "string",
      enum: ["cash", "card", "bank_transfer", "credit"],
    },
    notes: { type: "string" },
    idempotencyKey: { type: "string" },
  },
  additionalProperties: false,
} as const;

const CustomerAdjustmentBodySchema = {
  type: "object" as const,
  required: ["amount"],
  properties: {
    amount: {
      type: "number",
      description: "Adjustment amount (positive or negative)",
    },
    notes: { type: "string" },
  },
  additionalProperties: false,
} as const;

const ReconcileQuerySchema = {
  type: "object" as const,
  properties: {
    repair: {
      type: "string",
      enum: ["true", "false"],
      description: "If true, auto-correct discrepancies",
    },
  },
} as const;

export const getCustomerLedgerSchema = {
  tags: ["Customer Ledger"],
  summary: "Get customer ledger entries",
  security: [{ bearerAuth: [] }],
  params: CustomerIdParamsSchema,
  querystring: LedgerQuerySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          entries: { type: "array", items: CustomerLedgerEntrySchema },
          balance: { type: "integer" },
        },
      },
      "Customer ledger",
    ),
    ...ErrorResponses,
  },
} as const;

export const recordCustomerPaymentSchema = {
  tags: ["Customer Ledger"],
  summary: "Record a customer payment",
  security: [{ bearerAuth: [] }],
  params: CustomerIdParamsSchema,
  body: CustomerPaymentBodySchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Payment recorded"),
    ...ErrorResponses,
  },
} as const;

export const addCustomerAdjustmentSchema = {
  tags: ["Customer Ledger"],
  summary: "Add customer ledger adjustment",
  security: [{ bearerAuth: [] }],
  params: CustomerIdParamsSchema,
  body: CustomerAdjustmentBodySchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Adjustment recorded"),
    ...ErrorResponses,
  },
} as const;

export const reconcileCustomerDebtSchema = {
  tags: ["Customer Ledger"],
  summary: "Reconcile customer debt",
  description: "Check (or repair) customer debt totals against ledger sum.",
  security: [{ bearerAuth: [] }],
  querystring: ReconcileQuerySchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Reconciliation result"),
    ...ErrorResponses,
  },
} as const;
