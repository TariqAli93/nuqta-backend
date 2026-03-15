import { FastifyPluginAsync } from "fastify";
import {
  InitializeAccountingUseCase,
} from "@nuqta/core";
import {
  ErrorResponses,
  successEnvelope,
  successArrayEnvelope,
  successPaginatedEnvelope,
} from "../../../shared/schema-helpers.js";
import { requirePermission } from "../../../middleware/rbac.js";

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

const getAccountsSchema = {
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
    200: successPaginatedEnvelope(JournalEntrySchema, "Journal entries"),
    ...ErrorResponses,
  },
} as const;

const getEntryByIdSchema = {
  tags: ["Accounting"],
  summary: "Get journal entry by ID",
  security: [{ bearerAuth: [] }],
  params: { $ref: "IdParams#" },
  response: {
    200: successEnvelope(JournalEntrySchema, "Journal entry details"),
    ...ErrorResponses,
  },
} as const;

const getTrialBalanceSchema = {
  tags: ["Accounting"],
  summary: "Get trial balance",
  security: [{ bearerAuth: [] }],
  querystring: DateRangeQuerySchema,
  response: {
    200: successArrayEnvelope(TrialBalanceRowSchema, "Trial balance"),
    ...ErrorResponses,
  },
} as const;

const getProfitLossSchema = {
  tags: ["Accounting"],
  summary: "Get profit & loss report",
  security: [{ bearerAuth: [] }],
  querystring: DateRangeQuerySchema,
  response: {
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Profit & loss report",
    ),
    ...ErrorResponses,
  },
} as const;

const initializeAccountingSchema = {
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
    200: successEnvelope(
      { type: "object" as const, additionalProperties: true },
      "Initialization result",
    ),
    ...ErrorResponses,
  },
} as const;

const getAccountingStatusSchema = {
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

const accounting: FastifyPluginAsync = async (fastify) => {
  // fastify.addHook("onRequest", fastify.authenticate);

  // GET /accounting/accounts
  fastify.get(
    "/accounts",
    {
      schema: getAccountsSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const data = await fastify.repos.accounting.getAccounts();
      return { ok: true, data };
    },
  );

  // GET /accounting/journal-entries
  fastify.get(
    "/journal-entries",
    {
      schema: getJournalEntriesSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const query = request.query as {
        sourceType?: string;
        dateFrom?: string;
        dateTo?: string;
        isPosted?: string;
        limit?: string;
        offset?: string;
      };
      const data = await fastify.repos.accounting.getJournalEntries({
        sourceType: query.sourceType,
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
        isPosted:
          query.isPosted !== undefined ? query.isPosted === "true" : undefined,
        limit: query.limit ? parseInt(query.limit, 10) : undefined,
        offset: query.offset ? parseInt(query.offset, 10) : undefined,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/journal-entries/:id
  fastify.get<{ Params: { id: string } }>(
    "/journal-entries/:id",
    {
      schema: getEntryByIdSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const id = parseInt(request.params.id, 10);
      const data = await fastify.repos.accounting.getEntryById(id);
      return { ok: true, data };
    },
  );

  // GET /accounting/trial-balance
  fastify.get(
    "/trial-balance",
    {
      schema: getTrialBalanceSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const query = request.query as { dateFrom?: string; dateTo?: string };
      const data = await fastify.repos.accounting.getTrialBalance({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/profit-loss
  fastify.get(
    "/profit-loss",
    {
      schema: getProfitLossSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const query = request.query as { dateFrom?: string; dateTo?: string };
      const data = await fastify.repos.accounting.getProfitLoss({
        dateFrom: query.dateFrom,
        dateTo: query.dateTo,
      });
      return { ok: true, data };
    },
  );

  // GET /accounting/balance-sheet
  fastify.get(
    "/balance-sheet",
    {
      schema: {
        tags: ["Accounting"],
        summary: "Get balance sheet",
        security: [{ bearerAuth: [] }],
        querystring: BalanceSheetDateRangeSchema,
        response: {
          200: successEnvelope(
            { type: "object" as const, additionalProperties: true },
            "Balance sheet",
          ),
          ...ErrorResponses,
        },
      },
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const query = request.query as { fromDate?: string; toDate?: string };
      const data = await fastify.repos.accounting.getBalanceSheet(query || {});
      return { ok: true, data };
    },
  );

  // POST /accounting/initialize
  fastify.post(
    "/initialize",
    {
      schema: initializeAccountingSchema,
      preHandler: [],
    },
    async (request) => {
      const body = request.body as any;
      const uc = new InitializeAccountingUseCase(
        fastify.repos.settings,
        fastify.repos.accounting,
      );
      const data = await uc.execute(body || {});
      return { ok: true, data };
    },
  );

  // GET /accounting/status
  fastify.get(
    "/status",
    {
      schema: getAccountingStatusSchema,
      preHandler: [fastify.authenticate, requirePermission("accounting:read")],
    },
    async (request) => {
      const uc = new InitializeAccountingUseCase(
        fastify.repos.settings,
        fastify.repos.accounting,
      );
      const data = await uc.getStatus();
      return { ok: true, data };
    },
  );
};

export default accounting;
