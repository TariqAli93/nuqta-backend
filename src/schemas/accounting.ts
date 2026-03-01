/**
 * Accounting domain schemas.
 */
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
} from "./common.js";

const AccountSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    code: { type: "string" },
    name: { type: "string" },
    nameAr: { type: "string", nullable: true },
    accountType: {
      type: "string",
      enum: ["asset", "liability", "equity", "revenue", "expense"],
    },
    parentId: { type: "integer", nullable: true },
    isSystem: { type: "boolean" },
    isActive: { type: "boolean" },
    balance: { type: "integer" },
    createdAt: { type: "string", format: "date-time" },
  },
};

const JournalLineSchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    journalEntryId: { type: "integer" },
    accountId: { type: "integer" },
    debit: { type: "integer" },
    credit: { type: "integer" },
    description: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
  },
};

const JournalEntrySchema = {
  type: "object" as const,
  properties: {
    id: { type: "integer" },
    entryNumber: { type: "string" },
    entryDate: { type: "string", format: "date-time" },
    description: { type: "string" },
    sourceType: {
      type: "string",
      nullable: true,
      enum: ["sale", "purchase", "payment", "adjustment", "manual"],
    },
    sourceId: { type: "integer", nullable: true },
    isPosted: { type: "boolean" },
    isReversed: { type: "boolean" },
    reversalOfId: { type: "integer", nullable: true },
    postingBatchId: { type: "integer", nullable: true },
    totalAmount: { type: "integer" },
    currency: { type: "string" },
    notes: { type: "string", nullable: true },
    createdAt: { type: "string", format: "date-time" },
    createdBy: { type: "integer", nullable: true },
    lines: { type: "array", items: JournalLineSchema },
  },
};

const JournalEntriesQuerySchema = {
  type: "object" as const,
  properties: {
    sourceType: {
      type: "string",
      enum: ["sale", "purchase", "payment", "adjustment", "manual"],
    },
    dateFrom: { type: "string", format: "date" },
    dateTo: { type: "string", format: "date" },
    isPosted: { type: "string", enum: ["true", "false"] },
    limit: { type: "string", pattern: "^\\d+$" },
    offset: { type: "string", pattern: "^\\d+$" },
  },
} as const;

const DateRangeQuerySchema = {
  type: "object" as const,
  properties: {
    dateFrom: { type: "string", format: "date" },
    dateTo: { type: "string", format: "date" },
  },
} as const;

const BalanceSheetDateRangeSchema = {
  type: "object" as const,
  properties: {
    fromDate: { type: "string", format: "date" },
    toDate: { type: "string", format: "date" },
  },
} as const;

const TrialBalanceRowSchema = {
  type: "object" as const,
  properties: {
    accountId: { type: "integer" },
    accountCode: { type: "string" },
    accountName: { type: "string" },
    accountType: { type: "string" },
    debit: { type: "integer" },
    credit: { type: "integer" },
    balance: { type: "integer" },
  },
};

export const getAccountsSchema = {
  tags: ["Accounting"],
  summary: "List chart of accounts",
  security: [{ bearerAuth: [] }],
  response: {
    200: successArrayEnvelope(AccountSchema, "Chart of accounts"),
    ...ErrorResponses,
  },
} as const;

export const getJournalEntriesSchema = {
  tags: ["Accounting"],
  summary: "List journal entries",
  security: [{ bearerAuth: [] }],
  querystring: JournalEntriesQuerySchema,
  response: {
    200: successArrayEnvelope(JournalEntrySchema, "Journal entries"),
    ...ErrorResponses,
  },
} as const;

export const getEntryByIdSchema = {
  tags: ["Accounting"],
  summary: "Get journal entry by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(JournalEntrySchema, "Journal entry details"),
    ...ErrorResponses,
  },
} as const;

export const getTrialBalanceSchema = {
  tags: ["Accounting"],
  summary: "Get trial balance",
  security: [{ bearerAuth: [] }],
  querystring: DateRangeQuerySchema,
  response: {
    200: successArrayEnvelope(TrialBalanceRowSchema, "Trial balance"),
    ...ErrorResponses,
  },
} as const;

export const getProfitLossSchema = {
  tags: ["Accounting"],
  summary: "Get profit & loss report",
  security: [{ bearerAuth: [] }],
  querystring: DateRangeQuerySchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Profit & loss report"),
    ...ErrorResponses,
  },
} as const;

export const getBalanceSheetSchema = {
  tags: ["Accounting"],
  summary: "Get balance sheet",
  security: [{ bearerAuth: [] }],
  querystring: BalanceSheetDateRangeSchema,
  response: {
    200: successEnvelope({ type: "object" as const }, "Balance sheet"),
    ...ErrorResponses,
  },
} as const;

export const initializeAccountingSchema = {
  tags: ["Accounting"],
  summary: "Initialize accounting system",
  description: "Set up initial chart of accounts. Idempotent operation.",
  security: [{ bearerAuth: [] }],
  body: {
    type: "object" as const,
    additionalProperties: true,
    description: "Optional initialization parameters",
  },
  response: {
    200: successEnvelope({ type: "object" as const }, "Initialization result"),
    ...ErrorResponses,
  },
} as const;

export const getAccountingStatusSchema = {
  tags: ["Accounting"],
  summary: "Get accounting system status",
  security: [{ bearerAuth: [] }],
  response: {
    200: successEnvelope(
      {
        type: "object" as const,
        properties: {
          isInitialized: { type: "boolean" },
          accountCount: { type: "integer" },
        },
      },
      "Accounting status",
    ),
    ...ErrorResponses,
  },
} as const;
