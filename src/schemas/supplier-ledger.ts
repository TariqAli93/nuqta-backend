/**
 * Supplier ledger domain schemas.
 */
import { ErrorResponses, successEnvelope } from "./common.js";

const SupplierLedgerEntrySchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    supplierId: { type: "integer" },
    transactionType: {
      type: "string",
      enum: ["invoice", "payment", "return", "adjustment", "opening"],
    },
    amount: { type: "integer" },
    balanceAfter: { type: "integer" },
    purchaseId: { type: "integer", nullable: true },
    paymentId: { type: "integer", nullable: true },
    journalEntryId: { type: "integer", nullable: true },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
  },
};

const SupplierIdParamsSchema = {
  type: "object" as const,
  required: ["supplierId"],
  properties: {
    supplierId: {
      type: "string",
      pattern: "^\\d+$",
      description: "Supplier ID",
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

const SupplierPaymentBodySchema = {
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

export const getSupplierLedgerSchema = {
  tags: ["Supplier Ledger"],
  summary: "Get supplier ledger entries",
  security: [{ bearerAuth: [] }],
  params: SupplierIdParamsSchema,
  querystring: LedgerQuerySchema,
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          entries: { type: "array", items: SupplierLedgerEntrySchema },
          balance: { type: "integer" },
        },
      },
      "Supplier ledger",
    ),
    ...ErrorResponses,
  },
} as const;

export const recordSupplierPaymentSchema = {
  tags: ["Supplier Ledger"],
  summary: "Record a supplier payment",
  security: [{ bearerAuth: [] }],
  params: SupplierIdParamsSchema,
  body: SupplierPaymentBodySchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Payment recorded"),
    ...ErrorResponses,
  },
} as const;

export const reconcileSupplierBalanceSchema = {
  tags: ["Supplier Ledger"],
  summary: "Reconcile supplier balance",
  description: "Check (or repair) supplier balance totals against ledger sum.",
  security: [{ bearerAuth: [] }],
  querystring: ReconcileQuerySchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Reconciliation result"),
    ...ErrorResponses,
  },
} as const;
